import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { catalog, resolveRuleset, type Pieces } from "@apexchess/engine";
import { archiveRow, type End, type StatsSnapshot } from "@apexchess/online";
import archive from "../migrations/0001_archive.sql?raw";
import statsTable from "../migrations/0002_stats.sql?raw";
import timeControl from "../migrations/0003_time_control.sql?raw";
import { insertGame } from "./archive";
import { getStats, listStats, refreshStats } from "./stats";

// node:sqlite stands in for D1: same SQL, same migrations.
const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite") as {
  DatabaseSync: new (path: string) => {
    exec(sql: string): void;
    prepare(sql: string): { all(...v: unknown[]): unknown[]; run(...v: unknown[]): unknown };
  };
};
function d1() {
  const db = new DatabaseSync(":memory:");
  db.exec(archive + statsTable + timeControl);
  const prepare = (sql: string) => {
    const bound = (values: unknown[]) => ({
      all: async () => ({ results: db.prepare(sql).all(...values) }),
      first: async () => db.prepare(sql).all(...values)[0] ?? null,
      run: async () => db.prepare(sql).run(...values),
    });
    return { ...bound([]), bind: (...values: unknown[]) => bound(values) };
  };
  return { db, d1: { prepare } as unknown as D1Database };
}

const ruleset = resolveRuleset(catalog, "standard");
const d = ruleset.setup.default.pieces;
const q: Pieces = { ...d, g1: "queen", g2: "bishop" };
const lightMates: End = { status: "checkmate", winner: "light" };
let n = 0;
function addGames(
  db: ReturnType<typeof d1>["db"],
  count: number,
  endDay: string,
  { version = ruleset.version, plies = 10 } = {},
) {
  for (let i = 0; i < count; i++) {
    const row = archiveRow({
      format: 2,
      ruleset: { id: ruleset.id, version },
      setups: { light: d, dark: q },
      moves: Array(plies).fill("e2e3"),
      end: lightMates,
      endDay,
      timeControl: "10+0",
    });
    const { sql, values } = insertGame(row, `g${n++}`);
    db.prepare(sql).run(...values);
  }
}
const at = (day: string, time = "00:07:00") => Date.parse(`${day}T${time}Z`);

describe("statistics table", () => {
  it("holds snapshots by ruleset id and version, and no game data", () => {
    const columns = [...statsTable.matchAll(/^\s+(\w+) (?:TEXT|INTEGER)/gm)].map((m) => m[1]);
    expect(columns).toEqual(["ruleset_id", "ruleset_version", "as_of", "games", "snapshot"]);
    expect(statsTable).toContain("PRIMARY KEY (ruleset_id, ruleset_version)");
  });
});

describe("daily statistics job", () => {
  it("counts whole UTC days before the run, games of at least 10 plies", async () => {
    const { db, d1: archiveDb } = d1();
    addGames(db, 30, "2026-10-20");
    addGames(db, 5, "2026-10-21", { plies: 9 });
    addGames(db, 7, "2026-10-22");
    expect(await refreshStats(archiveDb, at("2026-10-22"))).toBe(1);
    const snap = JSON.parse(
      (await getStats(archiveDb, ruleset.id, ruleset.version))!,
    ) as StatsSnapshot;
    expect(snap).toMatchObject({ asOf: "2026-10-21", games: 30 });
    expect(snap.firstMove.all).toMatchObject({ n: 30, wins: 30 });
  });

  it("replaces a version's snapshot on the next run, and keeps versions apart", async () => {
    const { db, d1: archiveDb } = d1();
    addGames(db, 30, "2026-10-20");
    addGames(db, 3, "2026-10-21", { version: "0.0.1" });
    await refreshStats(archiveDb, at("2026-10-21"));
    addGames(db, 4, "2026-10-21");
    await refreshStats(archiveDb, at("2026-10-22", "23:59:59"));
    expect(await listStats(archiveDb)).toEqual([
      { ruleset: { id: ruleset.id, version: ruleset.version }, asOf: "2026-10-21", games: 34 },
    ]);
    expect(await getStats(archiveDb, ruleset.id, "0.0.1")).toBeNull();
  });

  it("writes nothing when no game counts yet", async () => {
    const { db, d1: archiveDb } = d1();
    addGames(db, 30, "2026-10-22");
    expect(await refreshStats(archiveDb, at("2026-10-22"))).toBe(0);
    expect(await listStats(archiveDb)).toEqual([]);
  });
});

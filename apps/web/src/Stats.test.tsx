import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { catalog, resolveRuleset, type Pieces } from "@apexchess/engine";
import { archiveRow, statsSnapshot, type End } from "@apexchess/online";
import { StatsView, chooseListing, loadJson } from "./Stats";

const ruleset = resolveRuleset(catalog, "standard");
const ref = { id: ruleset.id, version: ruleset.version };
const d = ruleset.setup.default.pieces;
const q: Pieces = { ...d, g1: "queen", g2: "bishop" };
const row = (end: End) =>
  archiveRow({
    format: 1,
    ruleset: ref,
    setups: { light: d, dark: q },
    moves: Array(10).fill("e2e3"),
    end,
    endDay: "2026-10-21",
    timeControl: "10+0",
  });
const games = (n: number, end: End) => Array.from({ length: n }, () => row(end));

describe("Stats screen", () => {
  it("shows the first move, families, and features with the bar each table uses", () => {
    const snap = statsSnapshot(
      ruleset,
      [
        ...games(30, { status: "checkmate", winner: "light" }),
        ...games(10, { status: "draw", reason: "stalemate" }),
      ],
      "2026-10-21",
    )!;
    const html = renderToStaticMarkup(<StatsView snapshot={snap} />);
    expect(html).toContain("2026-10-21");
    expect(html).toContain("40 games");
    expect(html).toContain("First move");
    expect(html).toContain("Setup families");
    expect(html).toContain("Setup features");
    expect(html).toContain(`|z| ≥ ${snap.zCritical.families.toFixed(2)}`);
    expect(html).toContain("K/BR/RQB/PPPP/PPNPP/5N");
    expect(html).toContain("(default)");
    expect(html).toContain("at least 30 games");
    expect(html).toContain("at least 10 plies");
    expect(html).toContain("light ahead");
    expect(html).toContain('<th scope="col">Stands out</th>');
  });

  it("says when there are not enough games for any row", () => {
    const snap = statsSnapshot(
      ruleset,
      games(12, { status: "draw", reason: "stalemate" }),
      "2026-10-21",
    )!;
    const html = renderToStaticMarkup(<StatsView snapshot={snap} />);
    expect(html).toContain("12 games");
    expect(html).toContain("Not enough games yet");
    expect(html).not.toContain("<table");
  });

  it("opens on the ruleset version this app plays, else the first listed", () => {
    const other = { ruleset: { id: "standard", version: "0.9.0" }, asOf: "2026-10-21", games: 5 };
    const mine = { ruleset: ref, asOf: "2026-10-21", games: 50 };
    expect(chooseListing([other, mine], ref)).toBe(mine);
    expect(chooseListing([other], ref)).toBe(other);
    expect(chooseListing([], ref)).toBeUndefined();
  });

  it("reads JSON from the server, and gives a message when it cannot", async () => {
    const ok = async () => new Response("[1]", { status: 200 });
    expect(await loadJson(ok, "/api/stats")).toEqual([1]);
    const missing = async () => new Response("{}", { status: 404 });
    await expect(loadJson(missing, "/api/stats")).rejects.toThrow("Could not load statistics");
    const offline = async () => {
      throw new TypeError("offline");
    };
    await expect(loadJson(offline, "/api/stats")).rejects.toThrow("Could not load statistics");
  });
});

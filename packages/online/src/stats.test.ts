import { describe, expect, it } from "vitest";
import { catalog, mirrorSetup, resolveRuleset, type Pieces } from "@apexchess/engine";
import { zCritical } from "@apexchess/sim";
import { archiveRow, type ArchiveRecord } from "./archive";
import type { End } from "./protocol";
import { STATS_OPTIONS, statsSnapshot } from "./stats";

const ruleset = resolveRuleset(catalog, "standard");
const d = ruleset.setup.default.pieces;
// Same features as the default except the queen trades places with the g1 bishop.
const q: Pieces = { ...d, g1: "queen", g2: "bishop" };
const lightMates: End = { status: "checkmate", winner: "light" };
const darkResigns: End = { status: "resigned", winner: "light" };
const lightResigns: End = { status: "resigned", winner: "dark" };
const draw: End = { status: "draw", reason: "stalemate" };

const row = (light: Pieces, dark: Pieces, end: End, plies = 10) =>
  archiveRow({
    format: 1,
    ruleset: { id: ruleset.id, version: ruleset.version },
    setups: { light, dark },
    moves: Array.from({ length: plies }, () => "e2e3"),
    end,
    endDay: "2026-10-21",
  } satisfies ArchiveRecord);
const times = <T>(n: number, f: (i: number) => T) => Array.from({ length: n }, (_, i) => f(i));
const snap = (rows: ReturnType<typeof row>[]) => statsSnapshot(ruleset, rows, "2026-10-21")!;

describe("public setup statistics", () => {
  it("uses the D18 defaults: N ≥ 30, games of at least 10 plies, α = 0.05", () => {
    expect(STATS_OPTIONS).toEqual({ minGames: 30, minPlies: 10, alpha: 0.05 });
  });

  it("counts only games of at least 10 plies in a format it reads", () => {
    const short = times(40, () => row(d, q, lightMates, 9));
    expect(statsSnapshot(ruleset, short, "2026-10-21")).toBeUndefined();
    const future = times(40, () => Object.assign(row(d, q, lightMates), { format: 2 }));
    expect(statsSnapshot(ruleset, future, "2026-10-21")).toBeUndefined();
    const s = snap([...short, ...times(30, () => row(d, q, draw))]);
    expect(s.games).toBe(30);
  });

  it("scores checkmate, resignation, and draws from light's view", () => {
    const s = snap([
      ...times(10, () => row(d, q, lightMates)),
      ...times(5, () => row(d, q, darkResigns)),
      ...times(10, () => row(d, q, lightResigns)),
      ...times(5, () => row(d, q, draw)),
    ]);
    expect(s.firstMove.all).toMatchObject({ n: 30, wins: 15, draws: 5, losses: 10 });
    expect(s.firstMove.sameSetup).toBeNull();
    const [def, queen] = [s.families.find((f) => f.preset)!, s.families.find((f) => !f.preset)!];
    expect(def.summary).toMatchObject({ wins: 15, draws: 5, losses: 10 });
    expect(queen.summary).toMatchObject({ wins: 10, draws: 5, losses: 15 });
  });

  it("shows no row, first move included, below 30 games", () => {
    const s = snap(times(29, () => row(d, q, draw)));
    expect(s.games).toBe(29);
    expect(s.firstMove.all).toBeNull();
    expect(s.families).toEqual([]);
    expect(s.features).toEqual([]);
    const t = snap(times(30, () => row(d, q, draw)));
    expect(t.firstMove.all).not.toBeNull();
    expect(t.families).toHaveLength(2);
    expect(t.features.every((r) => r.summary.n >= 30)).toBe(true);
  });

  it("counts a setup and its mirror image as one family, and same-family games apart", () => {
    const m = mirrorSetup(ruleset.board, "light", d);
    const s = snap([...times(15, () => row(d, m, lightMates)), ...times(15, () => row(m, d, draw))]);
    expect(s.families).toEqual([]);
    expect(s.firstMove.sameSetup).toMatchObject({ n: 30, wins: 15, draws: 15 });
  });

  it("flags rows at the Bonferroni bar over the rows shown, and sorts families by games", () => {
    const s = snap([
      ...times(30, () => row(d, q, lightMates)),
      ...times(10, () => row(q, d, draw)),
      ...times(30, () => row(d, d, draw)),
    ]);
    expect(s.zCritical.families).toBeCloseTo(zCritical(0.05, s.families.length), 6);
    expect(s.zCritical.features).toBeCloseTo(zCritical(0.05, s.features.length), 6);
    expect(s.families.map((f) => f.summary.n)).toEqual([40, 40]);
    expect(s.families.map((f) => f.standsOut)).toEqual([true, true]);
    const even = snap(times(40, (i) => row(i % 2 ? d : q, i % 2 ? q : d, draw)));
    expect(even.families.map((f) => f.standsOut)).toEqual([false, false]);
  });

  it("writes plain JSON: an unbounded z is null, and nothing names a game", () => {
    const s = snap(times(30, () => row(d, q, lightMates)));
    expect(s.firstMove.all!.z).toBeNull();
    expect(JSON.parse(JSON.stringify(s))).toEqual(s);
    expect(s).toMatchObject({
      format: 1,
      ruleset: { id: ruleset.id, version: ruleset.version },
      asOf: "2026-10-21",
      options: STATS_OPTIONS,
    });
    expect(JSON.stringify(s)).not.toContain("e2e3");
  });
});

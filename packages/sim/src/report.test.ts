import { catalog, resolveRuleset, type Result } from "@apexchess/engine";
import { describe, expect, it } from "vitest";
import { buildReport, toMarkdown, type PlayedGame } from "./report";

const ruleset = resolveRuleset(catalog, "standard");
const d = ruleset.setup.default.pieces;
// Same features as the default except the queen trades places with the g1 bishop.
const q = { ...d, g1: "queen", g2: "bishop" };
const pool = [d, q];
const lightWins: Result = { status: "checkmate", winner: "light" };
const darkWins: Result = { status: "checkmate", winner: "dark" };
const draw: Result = { status: "draw", reason: "stalemate" };
const game = (light: number, dark: number, r: Result, capped = false): PlayedGame => ({
  index: 0,
  light,
  dark,
  result: r,
  plies: 10,
  capped,
});
const options = { minGames: 1, alpha: 0.05, capWarning: 0.05 };
const meta = { bot: { depth: 2, maxNodes: 3000 }, seed: 1, maxPlies: 400 };

describe("buildReport", () => {
  const games = [
    game(0, 0, lightWins),
    game(0, 0, draw),
    game(1, 1, darkWins),
    game(0, 1, lightWins),
    game(1, 0, lightWins),
    game(1, 0, draw, true),
  ];
  const report = buildReport(ruleset, pool, games, meta, options);

  it("scores the first move over all games and over same-setup games", () => {
    expect(report.firstMove.all).toMatchObject({ wins: 3, draws: 2, losses: 1 });
    expect(report.firstMove.sameSetup).toMatchObject({ wins: 1, draws: 1, losses: 1 });
  });

  it("scores families only against other families, from both colors", () => {
    const [def, queen] = [report.families[0]!, report.families[1]!];
    expect(def.label).toBe("K/BR/RQB/PPPP/PPNPP/5N");
    expect(def.summary).toMatchObject({ wins: 1, draws: 1, losses: 1 });
    expect(queen.summary).toMatchObject({ wins: 1, draws: 1, losses: 1 });
  });

  it("scores a feature value only in games where the two sides differ on it", () => {
    const rows = report.features.filter((r) => r.feature === "chord.queen");
    expect(rows.map((r) => [r.value, r.summary.wins, r.summary.draws, r.summary.losses])).toEqual([
      ["1", 1, 1, 1],
      ["2", 1, 1, 1],
    ]);
    expect(rows.map((r) => r.families)).toEqual([1, 1]);
    expect(report.features.some((r) => r.feature === "beyond")).toBe(false);
  });

  it("counts capped games and names the ruleset", () => {
    expect(report.capped).toBe(1);
    expect(report.games).toBe(6);
    expect(report.ruleset).toEqual({ id: ruleset.id, version: ruleset.version });
  });

  it("hides rows below the minimum and flags rows past the Bonferroni bar", () => {
    const many = Array.from({ length: 40 }, (_, i) =>
      game(i % 2, 1 - (i % 2), i % 2 ? darkWins : lightWins),
    );
    const r = buildReport(ruleset, pool, many, meta, { ...options, minGames: 30 });
    expect(r.families.map((f) => f.standsOut)).toEqual([true, true]);
    expect(r.zCritical.families).toBeCloseTo(2.24, 2);
    const even = many.map((g) => ({ ...g, result: draw }));
    const e = buildReport(ruleset, pool, even, meta, { ...options, minGames: 30 });
    expect(e.families.map((f) => f.standsOut)).toEqual([false, false]);
    const few = buildReport(ruleset, pool, many.slice(0, 20), meta, { ...options, minGames: 30 });
    expect(few.families).toEqual([]);
  });
});

describe("toMarkdown", () => {
  it("writes the tables and warns when too many games hit the ply cap", () => {
    const md = toMarkdown(buildReport(ruleset, pool, [game(0, 1, draw, true)], meta, options));
    expect(md).toContain("## First move");
    expect(md).toContain("## Setup families");
    expect(md).toContain("## Setup features");
    expect(md).toContain("Feature | Value | Families | Games");
    expect(md).toContain("standard@");
    expect(md).toMatch(/Warning: 100% of games hit the ply cap/);
    expect(md).toContain("docs/decisions/0003-self-play-measures.md");
  });
});

import { describe, expect, it } from "vitest";
import { normalCdf, summarize, zCritical } from "./stats";

describe("summarize", () => {
  it("scores wins, half draws, and gives win %", () => {
    const s = summarize({ wins: 6, draws: 2, losses: 2 });
    expect(s.n).toBe(10);
    expect(s.winPct).toBeCloseTo(0.6);
    expect(s.score).toBeCloseTo(0.7);
    // Per-game scores 1×6, ½×2, 0×2 around 0.7: sum of squares 1.6, sample variance 1.6/9.
    const se = Math.sqrt(1.6 / 9 / 10);
    expect(s.se).toBeCloseTo(se, 10);
    expect(s.z).toBeCloseTo(0.2 / se, 10);
    expect(s.low).toBeCloseTo(0.7 - 1.96 * se, 10);
    expect(s.high).toBeCloseTo(0.7 + 1.96 * se, 10);
  });

  it("gives z 0 for an all-draw tally and an infinite z for a clean sweep", () => {
    expect(summarize({ wins: 0, draws: 5, losses: 0 }).z).toBe(0);
    expect(summarize({ wins: 4, draws: 0, losses: 0 }).z).toBe(Infinity);
    expect(summarize({ wins: 0, draws: 0, losses: 4 }).z).toBe(-Infinity);
  });

  it("keeps the interval inside 0 to 1", () => {
    const s = summarize({ wins: 9, draws: 0, losses: 1 });
    expect(s.high).toBeLessThanOrEqual(1);
    expect(summarize({ wins: 1, draws: 0, losses: 9 }).low).toBeGreaterThanOrEqual(0);
  });

  it("refuses an empty tally", () => {
    expect(() => summarize({ wins: 0, draws: 0, losses: 0 })).toThrow();
  });
});

describe("normal distribution", () => {
  it("has the usual quantiles", () => {
    expect(normalCdf(0)).toBeCloseTo(0.5, 7);
    expect(normalCdf(1.959964)).toBeCloseTo(0.975, 6);
    expect(normalCdf(-1.959964)).toBeCloseTo(0.025, 6);
  });

  it("gives Bonferroni critical values", () => {
    expect(zCritical(0.05, 1)).toBeCloseTo(1.96, 2);
    expect(zCritical(0.05, 8)).toBeCloseTo(2.734, 2);
    expect(zCritical(0.05, 40)).toBeCloseTo(3.227, 2);
  });
});

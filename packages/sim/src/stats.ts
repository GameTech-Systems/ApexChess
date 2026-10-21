/** Scores and significance for self-play tallies (docs/decisions/0003-self-play-measures.md). */

export interface Tally {
  wins: number;
  draws: number;
  losses: number;
}

export interface Summary extends Tally {
  n: number;
  /** Wins / N. */
  winPct: number;
  /** (Wins + draws / 2) / N. */
  score: number;
  /** Sample standard deviation of the per-game scores, over √N. */
  se: number;
  /** (score − ½) / se. */
  z: number;
  /** 95% interval, clipped to 0 to 1. */
  low: number;
  high: number;
}

export const emptyTally = (): Tally => ({ wins: 0, draws: 0, losses: 0 });

/** Add one game's score (1, ½, or 0) to a tally. */
export function addScore(t: Tally, score: number): void {
  if (score === 1) t.wins++;
  else if (score === 0) t.losses++;
  else t.draws++;
}

export function summarize(t: Tally): Summary {
  const n = t.wins + t.draws + t.losses;
  if (!n) throw new Error("cannot summarize an empty tally");
  const score = (t.wins + t.draws / 2) / n;
  const ss = t.wins * (1 - score) ** 2 + t.draws * (0.5 - score) ** 2 + t.losses * score ** 2;
  const se = n > 1 ? Math.sqrt(ss / (n - 1) / n) : 0;
  const diff = score - 0.5;
  const z = se > 0 ? diff / se : diff === 0 ? 0 : diff > 0 ? Infinity : -Infinity;
  return {
    ...t,
    n,
    winPct: t.wins / n,
    score,
    se,
    z,
    low: Math.max(0, score - 1.96 * se),
    high: Math.min(1, score + 1.96 * se),
  };
}

/** Standard normal CDF (Abramowitz and Stegun 7.1.26, error below 1.5e-7). */
export function normalCdf(x: number): number {
  const t = 1 / (1 + (0.3275911 * Math.abs(x)) / Math.SQRT2);
  const poly =
    t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))));
  const erf = 1 - poly * Math.exp(-(x * x) / 2);
  return x >= 0 ? (1 + erf) / 2 : (1 - erf) / 2;
}

/** Two-sided Bonferroni critical |z| for `tests` tests at family-wise level `alpha`. */
export function zCritical(alpha: number, tests: number): number {
  const target = 1 - alpha / (2 * Math.max(1, tests));
  let lo = 0;
  let hi = 10;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (normalCdf(mid) < target) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

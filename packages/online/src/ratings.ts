/**
 * Ratings (S19d, D17 default, provisional; see docs/decisions/0006). Glicko-2, written in-house from
 * Glickman's paper, one pool per ruleset id. Only quick-match games between two different signed-in
 * accounts count, and only on a control with a clock or an abandonment rule (0006 "Abandoned
 * games"), so untimed games are unrated. Each finished game is its own rating period; a game that
 * never ends is never scored.
 */
import type { End } from "./protocol";
import { isRated, sideOf, type RoomData, type Seat } from "./room";

export interface Rating {
  rating: number;
  rd: number;
  volatility: number;
}

/** D17: start 1500, RD 350; the paper's usual starting volatility. */
export const NEW_RATING: Rating = { rating: 1500, rd: 350, volatility: 0.06 };
/** D17: τ, which limits how fast volatility changes. */
export const TAU = 0.5;
/** D17: a rating shows "?" while its RD is above this. */
export const SHOW_RD = 110;

const SCALE = 173.7178;
const EPSILON = 0.000001;

export interface Result {
  opponent: Rating;
  /** 1 win, ½ draw, 0 loss. */
  score: number;
}

/** One Glicko-2 rating period (Glickman, "Example of the Glicko-2 system", steps 2 to 8). */
export function glicko2(player: Rating, results: readonly Result[], tau = TAU): Rating {
  const mu = (player.rating - 1500) / SCALE;
  const phi = player.rd / SCALE;
  const sigma = player.volatility;
  const capped = (r: Rating): Rating => ({ ...r, rd: Math.min(r.rd, NEW_RATING.rd) });
  if (!results.length)
    return capped({ ...player, rd: Math.sqrt(phi * phi + sigma * sigma) * SCALE });

  const g = (p: number) => 1 / Math.sqrt(1 + (3 * p * p) / (Math.PI * Math.PI));
  let vInverse = 0;
  let sum = 0;
  for (const { opponent, score } of results) {
    const muJ = (opponent.rating - 1500) / SCALE;
    const gJ = g(opponent.rd / SCALE);
    const e = 1 / (1 + Math.exp(-gJ * (mu - muJ)));
    vInverse += gJ * gJ * e * (1 - e);
    sum += gJ * (score - e);
  }
  const v = 1 / vInverse;
  const delta = v * sum;

  // Step 5: the new volatility, by the Illinois algorithm.
  const a = Math.log(sigma * sigma);
  const f = (x: number) => {
    const ex = Math.exp(x);
    const d = phi * phi + v + ex;
    return (ex * (delta * delta - phi * phi - v - ex)) / (2 * d * d) - (x - a) / (tau * tau);
  };
  let A = a;
  let B: number;
  if (delta * delta > phi * phi + v) B = Math.log(delta * delta - phi * phi - v);
  else {
    let k = 1;
    while (f(a - k * tau) < 0) k++;
    B = a - k * tau;
  }
  let fA = f(A);
  let fB = f(B);
  while (Math.abs(B - A) > EPSILON) {
    const C = A + ((A - B) * fA) / (fB - fA);
    const fC = f(C);
    if (fC * fB <= 0) {
      A = B;
      fA = fB;
    } else fA /= 2;
    B = C;
    fB = fC;
  }
  const volatility = Math.exp(A / 2);

  const phiStar = Math.sqrt(phi * phi + volatility * volatility);
  const phiNew = 1 / Math.sqrt(1 / (phiStar * phiStar) + 1 / v);
  const muNew = mu + phiNew * phiNew * sum;
  return capped({ rating: muNew * SCALE + 1500, rd: phiNew * SCALE, volatility });
}

/** What players see: "?" while the rating is still uncertain (D17), else the rounded rating. */
export const ratingText = (r: Rating) => (r.rd > SHOW_RD ? "?" : String(Math.round(r.rating)));

/** Light's score for a finished game, or undefined for a result that has none. */
export function scoreOf(end: End): number | undefined {
  if (end.status === "noShow") return undefined;
  if (end.status === "draw") return 0.5;
  return end.winner === "light" ? 1 : 0;
}

/** A rated game that `before` → `after` just ended: the pool, both accounts, and light's score. */
export interface RatedGame {
  ruleset: string;
  light: string;
  dark: string;
  score: number;
}

export function ratedGame(before: RoomData, after: RoomData): RatedGame | undefined {
  const { end } = after;
  if (!end || before.end || !after.record || !isRated(after)) return undefined;
  const score = scoreOf(end);
  if (score === undefined) return undefined;
  const lightSeat: Seat = sideOf(after, 0) === "light" ? 0 : 1;
  return {
    ruleset: after.ruleset.id,
    light: after.seats[lightSeat]!.account!,
    dark: after.seats[1 - lightSeat]!.account!,
    score,
  };
}

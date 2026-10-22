/**
 * Event pairings (D20 default, provisional; docs/decisions/0007): round robin up to 8 players,
 * Swiss above. Players are numbered from 0 in joining order. Pairing decides sides; a coin settles
 * round 1 only. Pure: the coin comes in as `random`.
 */
import type { Random } from "@apexchess/engine";

/** One board: `dark` is absent for a bye. */
export interface Pairing {
  light: number;
  dark?: number;
}

/** A finished board: points for [light, dark]. A bye scores [BYE_SCORE, 0]. */
export interface Played extends Pairing {
  score: [number, number];
}

/** D20: a player who cannot be paired gets a 1-point bye, at most once. */
export const BYE_SCORE = 1;

export const roundRobinRounds = (n: number) => (n % 2 ? n : n - 1);

/**
 * Round `round` (from 0) of a Berger table by the circle method: with an odd number of players the
 * fixed seat is empty, so its opponent has the bye. Sides alternate for most players and end within
 * one of even. `swap` (the round-1 coin) turns every board around.
 */
export function roundRobinRound(n: number, round: number, swap = false): Pairing[] {
  const m = n + (n % 2);
  const fixed = m - 1;
  // Stepping by m/2 makes round r pair seats whose numbers add up to r (mod m - 1).
  const at = (i: number) => (i + round * (m / 2)) % (m - 1);
  const boards: [number, number][] = [round % 2 ? [fixed, at(0)] : [at(0), fixed]];
  for (let k = 1; k < m / 2; k++) boards.push([at(k), at(m - 1 - k)]);
  return boards.map(([a, b]) => {
    if (a >= n || b >= n) return { light: a >= n ? b : a };
    return swap ? { light: b, dark: a } : { light: a, dark: b };
  });
}

/** D20: ⌈log₂ n⌉ + 1 rounds. */
export const swissRounds = (n: number) => Math.ceil(Math.log2(n)) + 1;

interface Record {
  score: number;
  met: Set<number>;
  /** Light games minus dark games. */
  balance: number;
  last?: "light" | "dark";
  bye: boolean;
}

function records(n: number, history: readonly Played[][]): Record[] {
  const recs = Array.from({ length: n }, () => ({
    score: 0,
    met: new Set<number>(),
    balance: 0,
    bye: false,
  })) as Record[];
  for (const round of history)
    for (const g of round) {
      const light = recs[g.light]!;
      light.score += g.score[0];
      if (g.dark === undefined) {
        light.bye = true;
        continue;
      }
      const dark = recs[g.dark]!;
      dark.score += g.score[1];
      light.met.add(g.dark);
      dark.met.add(g.light);
      light.balance++;
      dark.balance--;
      light.last = "light";
      dark.last = "dark";
    }
  return recs;
}

/** Stop searching for a pairing at one strictness after this many steps and relax it. */
const SEARCH_LIMIT = 100_000;

/** How strict a pairing search is: no repeats and no side difference above 2, then each relaxed. */
type Strictness = { repeats: boolean; sides: boolean };
const STRICTNESS: Strictness[] = [
  { repeats: false, sides: true },
  { repeats: false, sides: false },
  { repeats: true, sides: false },
];

/** The side a player should get next: light after more darks, dark after more lights, else alternate. */
const wants = (r: Record): "light" | "dark" | undefined =>
  r.balance < 0
    ? "light"
    : r.balance > 0
      ? "dark"
      : r.last && (r.last === "light" ? "dark" : "light");

/** Whether the board leaves both players within two games of even. */
function sidesOk(board: Pairing, recs: Record[]): boolean {
  return recs[board.light]!.balance < 2 && recs[board.dark!]!.balance > -2;
}

/**
 * Pairs a ranked list top down, each with the highest-ranked opponent that keeps the rest pairable;
 * within a score group, an opponent who wants the other side comes first.
 */
function pairUp(
  list: number[],
  recs: Record[],
  rule: Strictness,
  budget: { left: number },
): Pairing[] | undefined {
  if (!list.length) return [];
  const [top, ...rest] = list as [number, ...number[]];
  const t = recs[top]!;
  const tw = wants(t);
  const candidates = rest
    .map((q, i) => ({ q, i }))
    .sort((a, b) => {
      const ra = recs[a.q]!;
      const rb = recs[b.q]!;
      if (ra.score !== rb.score) return a.i - b.i;
      const fa = tw !== undefined && wants(ra) === tw ? 1 : 0;
      const fb = tw !== undefined && wants(rb) === tw ? 1 : 0;
      return fa - fb || a.i - b.i;
    });
  for (const { q, i } of candidates) {
    if (--budget.left < 0) return undefined;
    if (!rule.repeats && t.met.has(q)) continue;
    const board = sides(top, q, recs);
    if (rule.sides && !sidesOk(board, recs)) continue;
    const others = pairUp(
      rest.filter((_, j) => j !== i),
      recs,
      rule,
      budget,
    );
    if (others) return [board, ...others];
  }
  return undefined;
}

/**
 * Sides for higher-ranked `p` against `q`: the player with fewer light games gets light; then the one
 * who last had dark; then `p` takes the side it did not have last (light if it has none yet).
 */
function sides(p: number, q: number, recs: Record[]): Pairing {
  const a = recs[p]!;
  const b = recs[q]!;
  const pLight =
    a.balance !== b.balance
      ? a.balance < b.balance
      : a.last !== b.last && a.last && b.last
        ? a.last === "dark"
        : a.last !== "light";
  return pLight ? { light: p, dark: q } : { light: q, dark: p };
}

/**
 * The next Swiss round after `history`. Ranked by score, then joining order; paired top down with no
 * repeat pairings, and the bye goes to the lowest-ranked player who has not had one. Round 1 pairs in
 * joining order, and the coin gives each board's light side.
 */
export function swissRound(n: number, history: readonly Played[][], random: Random): Pairing[] {
  const recs = records(n, history);
  const order = Array.from({ length: n }, (_, i) => i).sort(
    (a, b) => recs[b]!.score - recs[a]!.score || a - b,
  );
  const byeCandidates = n % 2 ? [...order].reverse().filter((p) => !recs[p]!.bye) : [undefined];
  const first = !history.length;
  for (const rule of first ? STRICTNESS.slice(0, 1) : STRICTNESS)
    for (const bye of byeCandidates) {
      const list = order.filter((p) => p !== bye);
      const boards = pairUp(list, recs, rule, { left: SEARCH_LIMIT });
      if (!boards) continue;
      // Round 1: the coin gives each board's sides.
      const sided = first
        ? boards.map((g) => (random() < 0.5 ? g : { light: g.dark!, dark: g.light }))
        : boards;
      return bye === undefined ? sided : [...sided, { light: bye }];
    }
  throw new Error(`swissRound: no pairing for ${n} players`);
}

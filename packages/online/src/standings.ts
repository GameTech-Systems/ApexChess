/**
 * Event standings and crosstable from finished boards (D20 default, provisional; 0007). Tiebreaks:
 * Sonneborn-Berger for round robin, Buchholz for Swiss. A bye scores its points but adds nothing to
 * either tiebreak (Claude's choice, provisional).
 */
import type { Side } from "@apexchess/engine";
import type { Played } from "./pairing";

export type Tiebreak = "sonnebornBerger" | "buchholz";

export interface Standing {
  player: number;
  score: number;
  tiebreak: number;
  /** From 1; players equal on score and tiebreak share a rank. */
  rank: number;
}

/** One player's game in a round; `opponent` and `side` are absent for a bye. */
export interface CrossCell {
  round: number;
  opponent?: number;
  side?: Side;
  score: number;
}

/** Each player's finished games, in round order. */
export function crosstable(n: number, rounds: readonly Played[][]): CrossCell[][] {
  const table = Array.from({ length: n }, () => [] as CrossCell[]);
  rounds.forEach((round, r) => {
    for (const g of round) {
      if (g.dark === undefined) {
        table[g.light]!.push({ round: r, score: g.score[0] });
        continue;
      }
      table[g.light]!.push({ round: r, opponent: g.dark, side: "light", score: g.score[0] });
      table[g.dark]!.push({ round: r, opponent: g.light, side: "dark", score: g.score[1] });
    }
  });
  return table;
}

/** Players best first: score, then the tiebreak, then joining order. */
export function standings(n: number, rounds: readonly Played[][], tiebreak: Tiebreak): Standing[] {
  const table = crosstable(n, rounds);
  const scores = table.map((cells) => cells.reduce((s, c) => s + c.score, 0));
  const tb = table.map((cells) =>
    cells.reduce((s, c) => {
      if (c.opponent === undefined) return s;
      const opp = scores[c.opponent]!;
      return s + (tiebreak === "buchholz" ? opp : opp * c.score);
    }, 0),
  );
  const order = scores
    .map((score, player) => ({ player, score, tiebreak: tb[player]!, rank: 0 }))
    .sort((a, b) => b.score - a.score || b.tiebreak - a.tiebreak || a.player - b.player);
  order.forEach((s, i) => {
    const prev = order[i - 1];
    s.rank = prev && prev.score === s.score && prev.tiebreak === s.tiebreak ? prev.rank : i + 1;
  });
  return order;
}

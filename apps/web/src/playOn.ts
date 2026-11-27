import {
  replay,
  result,
  type GameRecord,
  type Pieces,
  type ResolvedRuleset,
  type Side,
} from "@apexchess/engine";
import { seatOf } from "./seats";

/** What `Game` needs to carry on a game: the moves so far, and who sits where (see `seatOf`). */
export interface Resume {
  record: GameRecord;
  /** Player 1's setup, then player 2's. */
  setups: [Pieces, Pieces];
  /** The game number that seats player 1 on the chosen side; a rematch alternates from there. */
  game: number;
}

/**
 * A game can be played on after `step` moves if it is of the live ruleset version (a retired
 * version replays but starts no new games, D21) and the position then is not over.
 */
export function canPlayOn(live: ResolvedRuleset, record: GameRecord, step: number): boolean {
  if (record.ruleset.id !== live.id || record.ruleset.version !== live.version) return false;
  if (!Number.isInteger(step) || step < 0 || step > record.moves.length) return false;
  const shown = replay(live, { ...record, moves: record.moves.slice(0, step) });
  return result(live, shown).status === "ongoing";
}

/** Continue from `record` after `step` moves, with player 1 on `side`. */
export function resumeFrom(record: GameRecord, step: number, side: Side): Resume {
  const game = seatOf(0, 0) === side ? 0 : 1;
  const mine = record.setups[side];
  const theirs = record.setups[side === "light" ? "dark" : "light"];
  return {
    record: { ...record, moves: record.moves.slice(0, step) },
    setups: [mine, theirs],
    game,
  };
}

/** What was played: ruleset id and version, both setups, and every move. */
import { legalMoves, newGame, play, type GameState } from "./game";
import { moveText, startPosition, type Move } from "./moves";
import type { ResolvedRuleset } from "./rules";
import type { Pieces } from "./setup";

export interface GameRecord {
  ruleset: { id: string; version: string };
  /** Each setup is written for light, as in `startPosition`. */
  setups: { light: Pieces; dark: Pieces };
  moves: string[];
}

export function newRecord(ruleset: ResolvedRuleset, light: Pieces, dark: Pieces): GameRecord {
  return {
    ruleset: { id: ruleset.id, version: ruleset.version },
    setups: { light: { ...light }, dark: { ...dark } },
    moves: [],
  };
}

/** The game a record describes. Throws on another ruleset id or version, or an illegal move. */
export function replay(ruleset: ResolvedRuleset, record: GameRecord): GameState {
  if (record.ruleset.id !== ruleset.id || record.ruleset.version !== ruleset.version)
    throw new Error(
      `record is for ${record.ruleset.id}@${record.ruleset.version}, not ${ruleset.id}@${ruleset.version} (version mismatch)`,
    );
  let game = newGame(ruleset, startPosition(ruleset, record.setups.light, record.setups.dark));
  for (const text of record.moves) {
    const move = legalMoves(ruleset, game.position).find((m) => moveText(m) === text);
    if (!move) throw new Error(`illegal move ${text} in record`);
    game = play(ruleset, game, move);
  }
  return game;
}

/** A new record with `move` appended. Throws if the move is illegal. */
export function addMove(ruleset: ResolvedRuleset, record: GameRecord, move: Move): GameRecord {
  play(ruleset, replay(ruleset, record), move);
  return { ...record, moves: [...record.moves, moveText(move)] };
}

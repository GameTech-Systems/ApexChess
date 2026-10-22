import {
  legalMoves,
  moveText,
  play,
  replay,
  type GameRecord,
  type GameState,
  type ResolvedRuleset,
} from "@apexchess/engine";

/** Game states already worked out, by record object. A full replay costs a lot more than one move. */
const known = new WeakMap<GameRecord, GameState>();

const sameStart = (a: GameRecord, b: GameRecord) =>
  a.ruleset.id === b.ruleset.id &&
  a.ruleset.version === b.ruleset.version &&
  JSON.stringify(a.setups) === JSON.stringify(b.setups) &&
  a.moves.length <= b.moves.length &&
  a.moves.every((m, i) => b.moves[i] === m);

/**
 * The game `record` describes, as `replay` gives it. When `prev` (worked out earlier) is the same
 * game with fewer moves, only the new moves are played. Throws on an illegal move.
 */
export function follow(ruleset: ResolvedRuleset, record: GameRecord, prev?: GameRecord): GameState {
  const hit = known.get(record);
  if (hit) return hit;
  const base = prev && known.get(prev);
  let game: GameState;
  if (base && prev && sameStart(prev, record) && sameRulesetRef(ruleset, record)) {
    game = base;
    for (const text of record.moves.slice(prev.moves.length)) {
      const move = legalMoves(ruleset, game.position).find((m) => moveText(m) === text);
      if (!move) throw new Error(`illegal move ${text} in record`);
      game = play(ruleset, game, move);
    }
  } else game = replay(ruleset, record);
  known.set(record, game);
  return game;
}

const sameRulesetRef = (ruleset: ResolvedRuleset, record: GameRecord) =>
  ruleset.id === record.ruleset.id && ruleset.version === record.ruleset.version;

import {
  bestMove,
  randomMove,
  type GameState,
  type Move,
  type Random,
  type ResolvedRuleset,
} from "@apexchess/engine";

/** Computer strengths: a random legal mover, then searches of growing depth (node caps keep moves quick). */
export const levels = {
  random: { label: "Random moves" },
  easy: { label: "Easy", depth: 1 },
  medium: { label: "Medium", depth: 2 },
  hard: { label: "Hard", depth: 4, maxNodes: 25000 },
} as const;
export type Level = keyof typeof levels;
export const DEFAULT_LEVEL: Level = "medium";

/** The computer's move at `level`; undefined when the game is over. */
export function computerMove(
  ruleset: ResolvedRuleset,
  game: GameState,
  level: Level,
  random: Random,
): Move | undefined {
  const l = levels[level];
  if (!("depth" in l)) return randomMove(ruleset, game, random);
  return bestMove(ruleset, game, { ...l, random });
}

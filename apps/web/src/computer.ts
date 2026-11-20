import {
  bestMove,
  randomMove,
  seededRandom,
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

/** What the page sends the computer's Web Worker: plain data, so it survives structured cloning. */
export interface MoveRequest {
  ruleset: ResolvedRuleset;
  game: GameState;
  level: Level;
  /** Seeds the search's tie-breaking, so a request always gets the same move. */
  seed: number;
}

/** The worker's reply to a request (null when the game is over). */
export function answer({ ruleset, game, level, seed }: MoveRequest): Move | null {
  return computerMove(ruleset, game, level, seededRandom(seed)) ?? null;
}

/**
 * The computer's move, searched in a Web Worker so the page never freezes (I14). Without Worker
 * support, or if the worker fails, it searches on the page. `cancel` stops the worker; its move
 * then never arrives.
 */
export function thinkMove(request: MoveRequest): {
  move: Promise<Move | undefined>;
  cancel: () => void;
} {
  const onPage = () => answer(request) ?? undefined;
  if (typeof Worker === "undefined")
    return { move: Promise.resolve().then(onPage), cancel: () => {} };
  const worker = new Worker(new URL("./computer.worker.ts", import.meta.url), { type: "module" });
  const move = new Promise<Move | undefined>((resolve) => {
    worker.onmessage = (e: MessageEvent<Move | null>) => {
      worker.terminate();
      resolve(e.data ?? undefined);
    };
    worker.onerror = () => {
      worker.terminate();
      resolve(onPage());
    };
  });
  worker.postMessage(request);
  return { move, cancel: () => worker.terminate() };
}

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

/** Node cap for a search on the page (the worker fallback), so a failed worker cannot freeze it for long. */
export const FALLBACK_MAX_NODES = 5000;

/** The computer's move at `level`; undefined when the game is over. `maxNodes` only ever lowers a level's cap. */
export function computerMove(
  ruleset: ResolvedRuleset,
  game: GameState,
  level: Level,
  random: Random,
  maxNodes?: number,
): Move | undefined {
  const l = levels[level];
  if (!("depth" in l)) return randomMove(ruleset, game, random);
  const own = "maxNodes" in l ? l.maxNodes : undefined;
  const cap = Math.min(own ?? Infinity, maxNodes ?? Infinity);
  return bestMove(ruleset, game, {
    ...l,
    random,
    ...(cap === Infinity ? {} : { maxNodes: cap }),
  });
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
export function answer(
  { ruleset, game, level, seed }: MoveRequest,
  maxNodes?: number,
): Move | null {
  return computerMove(ruleset, game, level, seededRandom(seed), maxNodes) ?? null;
}

/**
 * The computer's move, searched in a Web Worker so the page never freezes (I14). Without Worker
 * support, or if the worker fails (it cannot start, errors, or sends back something unreadable),
 * it logs why and searches on the page at a lower node cap, after a tick so the page can paint first. `cancel` stops
 * the worker; a worker's move then never arrives, and a fallback search that has not started is
 * skipped. If the page search fails too, the move is undefined.
 */
export function thinkMove(request: MoveRequest): {
  move: Promise<Move | undefined>;
  cancel: () => void;
} {
  let cancelled = false;
  let worker: Worker | undefined;
  const onPage = () =>
    new Promise<Move | undefined>((resolve) =>
      setTimeout(() => {
        try {
          resolve(cancelled ? undefined : (answer(request, FALLBACK_MAX_NODES) ?? undefined));
        } catch (error) {
          console.error("Computer move: the search failed on the page too.", error);
          resolve(undefined);
        }
      }, 0),
    );
  const cancel = () => {
    cancelled = true;
    worker?.terminate();
  };
  if (typeof Worker === "undefined") return { move: onPage(), cancel };
  const move = new Promise<Move | undefined>((resolve) => {
    const fallBack = (why: unknown) => {
      worker?.terminate();
      console.error("Computer move: the worker failed, searching on the page.", why);
      resolve(onPage());
    };
    try {
      worker = new Worker(new URL("./computer.worker.ts", import.meta.url), { type: "module" });
      worker.onmessage = (e: MessageEvent<Move | null>) => {
        worker?.terminate();
        resolve(e.data ?? undefined);
      };
      worker.onerror = (e) => fallBack(e);
      worker.onmessageerror = (e) => fallBack(e);
      worker.postMessage(request);
    } catch (error) {
      fallBack(error);
    }
  });
  return { move, cancel };
}

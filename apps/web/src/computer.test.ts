import { afterEach, describe, expect, it, vi } from "vitest";
import {
  catalog,
  legalMoves,
  moveText,
  newGame,
  resolveRuleset,
  seededRandom,
  startPosition,
} from "@apexchess/engine";
import {
  FALLBACK_MAX_NODES,
  answer,
  computerMove,
  levels,
  thinkMove,
  type Level,
} from "./computer";

const ruleset = resolveRuleset(catalog, "standard");
const preset = catalog.setups[0]!.pieces;

describe("computerMove", () => {
  for (const level of Object.keys(levels) as Level[]) {
    it(`plays a legal opening move at ${level}`, () => {
      const game = newGame(ruleset, startPosition(ruleset, preset, preset));
      const move = computerMove(ruleset, game, level, seededRandom(1))!;
      expect(legalMoves(ruleset, game.position).map(moveText)).toContain(moveText(move));
    });
  }
});

describe("thinkMove", () => {
  const game = () => newGame(ruleset, startPosition(ruleset, preset, preset));
  const request = () => ({ ruleset, game: game(), level: "medium" as Level, seed: 9 });
  const expected = () => moveText(computerMove(ruleset, game(), "medium", seededRandom(9))!);

  afterEach(() => vi.unstubAllGlobals());

  it("answers a request with the move computerMove gives for its seed", () => {
    expect(moveText(answer(request())!)).toBe(expected());
  });

  it("searches on the page where there is no Web Worker", async () => {
    vi.stubGlobal("Worker", undefined);
    expect(moveText((await thinkMove(request()).move)!)).toBe(expected());
  });

  it("searches in a Web Worker and stops it when cancelled", async () => {
    const workers: FakeWorker[] = [];
    class FakeWorker {
      onmessage?: (e: { data: unknown }) => void;
      onerror?: () => void;
      terminated = false;
      constructor() {
        workers.push(this);
      }
      postMessage(data: Parameters<typeof answer>[0]) {
        const reply = structuredClone(answer(structuredClone(data)) ?? null);
        queueMicrotask(() => this.onmessage?.({ data: reply }));
      }
      terminate() {
        this.terminated = true;
      }
    }
    vi.stubGlobal("Worker", FakeWorker);
    expect(moveText((await thinkMove(request()).move)!)).toBe(expected());
    expect(workers[0]!.terminated).toBe(true);
    thinkMove(request()).cancel();
    expect(workers[1]!.terminated).toBe(true);
  });

  describe("when the worker fails", () => {
    const stubWorker = (behaviour: "error" | "throws" | "messageerror") => {
      class BadWorker {
        onmessage?: unknown;
        onerror?: () => void;
        onmessageerror?: () => void;
        terminated = false;
        constructor() {
          if (behaviour === "throws") throw new Error("worker blocked");
        }
        postMessage() {
          queueMicrotask(() =>
            behaviour === "messageerror" ? this.onmessageerror?.() : this.onerror?.(),
          );
        }
        terminate() {
          this.terminated = true;
        }
      }
      vi.stubGlobal("Worker", BadWorker);
    };
    const quietLog = () => vi.spyOn(console, "error").mockImplementation(() => {});

    for (const behaviour of ["error", "throws", "messageerror"] as const) {
      it(`logs it and still moves on the page (${behaviour})`, async () => {
        const log = quietLog();
        stubWorker(behaviour);
        expect(moveText((await thinkMove(request()).move)!)).toBe(expected());
        expect(log).toHaveBeenCalledTimes(1);
        log.mockRestore();
      });
    }

    it("searches at the lower node cap, and never raises a level's own cap", async () => {
      const log = quietLog();
      stubWorker("error");
      const hard = { ...request(), level: "hard" as Level };
      const capped = moveText(answer(hard, FALLBACK_MAX_NODES)!);
      expect(moveText((await thinkMove(hard).move)!)).toBe(capped);
      expect(FALLBACK_MAX_NODES).toBeLessThan(levels.hard.maxNodes);
      const easy = request();
      expect(moveText(answer(easy, 10 ** 9)!)).toBe(moveText(answer(easy)!));
      log.mockRestore();
    });

    it("does not search inside the error handler, so the page can paint first", async () => {
      const log = quietLog();
      stubWorker("error");
      const order: string[] = [];
      const pending = thinkMove(request()).move.then(() => order.push("moved"));
      await Promise.resolve();
      order.push("page ran");
      await pending;
      expect(order).toEqual(["page ran", "moved"]);
      log.mockRestore();
    });

    it("gives no move, and says why, when the page search fails too", async () => {
      const log = quietLog();
      stubWorker("error");
      const bad = { ...request(), level: "nope" as Level };
      expect(await thinkMove(bad).move).toBeUndefined();
      expect(log).toHaveBeenCalledTimes(2);
      log.mockRestore();
    });

    it("does not search after being cancelled", async () => {
      const log = quietLog();
      stubWorker("error");
      const thinking = thinkMove(request());
      thinking.cancel();
      expect(await thinking.move).toBeUndefined();
      log.mockRestore();
    });
  });
});

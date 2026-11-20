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
import { answer, computerMove, levels, thinkMove, type Level } from "./computer";

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
});

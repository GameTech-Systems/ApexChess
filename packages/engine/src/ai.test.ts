import { describe, expect, it } from "vitest";
import fixtureData from "../test/fixtures/ai.json";
import { bestMove, chooseSetup, evaluate, pieceValues, randomMove, seededRandom } from "./ai";
import { catalog } from "./catalog";
import { legalMoves, makeMove, newGame, play, result, type GameState } from "./game";
import { moveText, startPosition, type Position } from "./moves";
import { resolveRuleset, type Side } from "./rules";

interface Fixture {
  name: string;
  parameters?: Record<string, string>;
  turn: Side;
  ply?: number;
  unmoved?: string[];
  pieces: Partial<Record<Side, Record<string, string>>>;
  best?: string;
  avoid?: string[];
  mates?: boolean;
}
const fixtures = (fixtureData as unknown as { positions: Fixture[] }).positions;

function rulesetWith(parameters: Record<string, string> = {}) {
  const c = structuredClone(catalog);
  Object.assign(c.rulesets.at(-1)!.parameters, parameters);
  return resolveRuleset(c, "standard");
}

function position(f: Fixture): Position {
  const squares: Position["squares"] = {};
  for (const side of ["light", "dark"] as const) {
    for (const [sq, piece] of Object.entries(f.pieces[side] ?? {})) squares[sq] = { side, piece };
  }
  return { squares, turn: f.turn, ply: f.ply ?? 10, unmoved: f.unmoved ?? [] };
}

const standard = resolveRuleset(catalog, "standard");
const preset = catalog.setups[0]!.pieces;
const opening = () => newGame(standard, startPosition(standard, preset, preset));

describe("seededRandom", () => {
  it("repeats for a seed and stays in [0, 1)", () => {
    const a = seededRandom(7);
    const b = seededRandom(7);
    const xs = Array.from({ length: 100 }, () => a());
    expect(xs).toEqual(Array.from({ length: 100 }, () => b()));
    expect(xs.every((x) => x >= 0 && x < 1)).toBe(true);
    expect(seededRandom(8)()).not.toBe(xs[0]);
  });
});

describe("randomMove", () => {
  it("plays a legal move, the same one for the same seed", () => {
    const game = opening();
    const legal = legalMoves(standard, game.position).map(moveText);
    const move = randomMove(standard, game, seededRandom(1))!;
    expect(legal).toContain(moveText(move));
    expect(moveText(randomMove(standard, game, seededRandom(1))!)).toBe(moveText(move));
    const seen = new Set(
      Array.from({ length: 20 }, (_, i) => moveText(randomMove(standard, game, seededRandom(i))!)),
    );
    expect(seen.size).toBeGreaterThan(1);
  });

  it("has no move when the game is over", () => {
    const f = fixtures[0]!;
    const mated = newGame(standard, makeMove(position(f), { from: "d2", to: "d8", piece: "rook" }));
    expect(randomMove(standard, mated, seededRandom(1))).toBeUndefined();
    expect(bestMove(standard, mated, { depth: 2 })).toBeUndefined();
  });
});

describe("chooseSetup", () => {
  it("picks a legal preset", () => {
    const illegal = { h1: "queen" };
    const pick = chooseSetup(standard, [illegal, preset], seededRandom(3));
    expect(pick).toEqual(preset);
  });

  it("refuses when no preset is legal", () => {
    expect(() => chooseSetup(standard, [{ h1: "queen" }], seededRandom(3))).toThrow();
  });
});

describe("evaluation from movement data", () => {
  it("ranks pieces by reach and gives royal pieces no material value", () => {
    const v = pieceValues(standard);
    expect(v.king).toBe(0);
    expect(v.queen).toBeGreaterThan(v.rook!);
    expect(v.rook).toBeGreaterThan(v.bishop!);
    expect(v.bishop).toBeGreaterThan(v.pawn!);
    expect(v.knight).toBeGreaterThan(v.pawn!);
  });

  it("scores mirrored setups as level", () => {
    expect(evaluate(standard, opening().position)).toBe(0);
  });

  it("favors the side with more material", () => {
    const pos = opening().position;
    const squares = { ...pos.squares };
    const darkQueen = Object.keys(squares).find(
      (sq) => squares[sq]!.side === "dark" && squares[sq]!.piece === "queen",
    )!;
    delete squares[darkQueen];
    expect(evaluate(standard, { ...pos, squares })).toBeGreaterThan(0);
    expect(evaluate(standard, { ...pos, squares, turn: "dark" })).toBeLessThan(0);
  });
});

describe("bestMove fixtures", () => {
  for (const f of fixtures) {
    it(f.name, () => {
      const ruleset = rulesetWith(f.parameters);
      const game = newGame(ruleset, position(f));
      const move = bestMove(ruleset, game, { depth: 3, random: seededRandom(1) })!;
      const text = moveText(move);
      expect(legalMoves(ruleset, game.position).map(moveText)).toContain(text);
      if (f.best) expect(text).toBe(f.best);
      for (const bad of f.avoid ?? []) expect(text).not.toBe(bad);
      if (f.mates) expect(result(ruleset, play(ruleset, game, move)).status).toBe("checkmate");
    });
  }

  it("covers every parameter at each option", () => {
    for (const p of catalog.parameters)
      for (const o of p.options)
        expect(
          fixtures.some((f) => (f.parameters?.[p.id] ?? p.default) === o.value),
          `${p.id}=${o.value}`,
        ).toBe(true);
  });
});

describe("bestMove", () => {
  it("is deterministic for a seed", () => {
    const game = opening();
    const a = bestMove(standard, game, { depth: 2, random: seededRandom(5) })!;
    const b = bestMove(standard, game, { depth: 2, random: seededRandom(5) })!;
    expect(moveText(a)).toBe(moveText(b));
  });

  it("plays a legal move within a tiny node budget", () => {
    const game = opening();
    const move = bestMove(standard, game, { depth: 4, maxNodes: 5 })!;
    expect(legalMoves(standard, game.position).map(moveText)).toContain(moveText(move));
  });

  it("plays a legal opening move under each parameter option", () => {
    for (const p of catalog.parameters)
      for (const o of p.options) {
        const ruleset = rulesetWith({ [p.id]: o.value });
        const game = newGame(ruleset, startPosition(ruleset, preset, preset));
        const move = bestMove(ruleset, game, { depth: 2 })!;
        expect(legalMoves(ruleset, game.position).map(moveText)).toContain(moveText(move));
      }
  });
});

describe("search horizon", () => {
  const pick = (ruleset: ReturnType<typeof rulesetWith>, game: GameState, depth = 1) =>
    moveText(bestMove(ruleset, game, { depth })!);
  const at = (f: Omit<Fixture, "name">) => position({ name: "", ...f });

  it("scores a mate found at the horizon above winning a queen", () => {
    const pos = at({
      turn: "light",
      pieces: { light: { b6: "king", d1: "rook" }, dark: { a8: "king", h1: "queen" } },
    });
    expect(pick(standard, newGame(standard, pos))).toBe("d1-d8");
  });

  it("searches quiet check evasions in quiescence (a skewer beats taking a knight)", () => {
    const pos = at({
      turn: "light",
      pieces: {
        light: { h1: "king", h4: "rook" },
        dark: { e6: "king", e8: "queen", e4: "pawn", h7: "knight" },
      },
    });
    expect(pick(standard, newGame(standard, pos))).toBe("h4xe4");
  });

  it("does not promote into stalemate", () => {
    const pos = at({
      turn: "light",
      pieces: { light: { d6: "king", a3: "knight", b7: "pawn" }, dark: { b6: "king" } },
    });
    const text = pick(standard, newGame(standard, pos));
    expect(text).not.toBe("b7-a8=queen");
    expect(text).toBe("b7-a8=rook");
  });

  it("counts a trade into dead material as a draw in quiescence", () => {
    const pos = at({
      turn: "light",
      pieces: {
        light: { h1: "king", d4: "rook" },
        dark: { a8: "king", d7: "rook", b6: "knight" },
      },
    });
    expect(pick(standard, newGame(standard, pos))).toBe("d4xd7");
  });

  describe("repetition key matches the game's (unmoved pieces, first-move rules)", () => {
    // Light is lost; g1-g5 hangs the rook unless it repeats an earlier position (a draw).
    const pieces = {
      light: { h1: "king", g1: "rook" },
      dark: { a8: "king", c5: "queen", d6: "pawn" },
    };
    const current = at({ turn: "light", pieces });
    const repeat = (ruleset: ReturnType<typeof rulesetWith>, unmoved: string[]) => {
      const before = { ...makeMove(current, { from: "g1", to: "g5", piece: "rook" }), unmoved };
      const game: GameState = {
        position: current,
        quietPlies: 1,
        history: [newGame(ruleset, before).history[0]!, newGame(ruleset, current).history[0]!],
      };
      return pick(ruleset, game);
    };

    it("takes a true repetition", () => {
      expect(repeat(standard, [])).toBe("g1-g5");
      // Under the default one-square first move, an unmoved pawn has the same moves.
      expect(repeat(standard, ["d6"])).toBe("g1-g5");
    });

    it("does not count a position where a pawn still had its two-square first move", () => {
      expect(repeat(rulesetWith({ pawnFirstMove: "two" }), ["d6"])).not.toBe("g1-g5");
    });
  });

  it("plays a legal move with a node budget of 0 or 1", () => {
    const game = opening();
    const legal = legalMoves(standard, game.position).map(moveText);
    for (const maxNodes of [0, 1])
      expect(legal).toContain(moveText(bestMove(standard, game, { depth: 3, maxNodes })!));
  });
});

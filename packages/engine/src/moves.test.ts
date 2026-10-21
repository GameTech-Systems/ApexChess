import { describe, expect, it } from "vitest";
import fixtureData from "../test/fixtures/moves.json";
import { catalog } from "./catalog";
import { generateMoves, moveText, startPosition, type Position } from "./moves";
import { resolveRuleset, type Side } from "./rules";
import { parseSquare } from "./setup";

interface Fixture {
  name: string;
  parameters?: Record<string, string>;
  turn: Side;
  ply?: number;
  unmoved?: string[];
  pieces?: Partial<Record<Side, Record<string, string>>>;
  start?: boolean;
  from?: string;
  moves?: string[];
  count?: number;
}
const fixtures = (fixtureData as unknown as { positions: Fixture[] }).positions;

function rulesetWith(parameters: Record<string, string> = {}) {
  const c = structuredClone(catalog);
  Object.assign(c.rulesets[0]!.parameters, parameters);
  return resolveRuleset(c, "standard");
}

function positionOf(f: Fixture, ruleset: ReturnType<typeof rulesetWith>): Position {
  if (f.start) {
    const setup = ruleset.setup.default.pieces;
    return { ...startPosition(ruleset, setup, setup), turn: f.turn, ply: f.ply ?? 0 };
  }
  const squares: Position["squares"] = {};
  for (const side of ["light", "dark"] as const) {
    for (const [sq, piece] of Object.entries(f.pieces?.[side] ?? {})) squares[sq] = { side, piece };
  }
  return { squares, turn: f.turn, ply: f.ply ?? 10, unmoved: f.unmoved ?? [] };
}

describe("generateMoves fixtures", () => {
  for (const f of fixtures) {
    it(f.name, () => {
      const ruleset = rulesetWith(f.parameters);
      const moves = generateMoves(ruleset, positionOf(f, ruleset)).filter(
        (m) => f.from === undefined || m.from === f.from,
      );
      if (f.count !== undefined) expect(moves).toHaveLength(f.count);
      if (f.moves) expect(moves.map(moveText).sort()).toEqual([...f.moves].sort());
    });
  }

  it("covers every parameter at every option", () => {
    for (const p of catalog.parameters) {
      for (const o of p.options) {
        expect(
          fixtures.some((f) => f.parameters?.[p.id] === o.value),
          `${p.id}=${o.value}`,
        ).toBe(true);
      }
    }
  });
});

describe("generateMoves", () => {
  const ruleset = rulesetWith();

  it("only moves the side to move, and records the captured piece", () => {
    const pos: Position = {
      squares: { e4: { side: "light", piece: "pawn" }, d4: { side: "dark", piece: "knight" } },
      turn: "dark",
      ply: 10,
      unmoved: [],
    };
    const moves = generateMoves(ruleset, pos);
    expect(moves.every((m) => m.from === "d4")).toBe(true);
    pos.turn = "light";
    expect(generateMoves(ruleset, pos).find((m) => m.to === "d4")).toMatchObject({
      piece: "pawn",
      captured: "knight",
    });
  });

  it("throws on a piece with no movement data", () => {
    const pos: Position = {
      squares: { e4: { side: "light", piece: "dragon" } },
      turn: "light",
      ply: 10,
      unmoved: [],
    };
    expect(() => generateMoves(ruleset, pos)).toThrow(/dragon/);
  });

  it("start position: both setups placed, light to move, every piece unmoved", () => {
    const setup = ruleset.setup.default.pieces;
    const pos = startPosition(ruleset, setup, setup);
    expect(pos.turn).toBe("light");
    expect(pos.ply).toBe(0);
    expect(Object.keys(pos.squares)).toHaveLength(32);
    expect(pos.unmoved).toHaveLength(32);
    expect(pos.squares.h1).toEqual({ side: "light", piece: "king" });
    expect(pos.squares.a8).toEqual({ side: "dark", piece: "king" });
  });
});

describe("standard pieces data", () => {
  const ruleset = rulesetWith();
  it("pawn ray step is the board's forward step for each side", () => {
    const step = ruleset.pieces.pieces.pawn!.moves[0]!.steps[0]!;
    expect(step).toEqual(ruleset.board.sides.light.forward);
    const dark = ruleset.board.sides.dark.forward;
    expect([-step[0], -step[1]]).toEqual(dark);
  });
  it("every promotion square is on the board", () => {
    for (const s of Object.values(ruleset.board.sides))
      for (const sq of s.promotionSquares)
        expect(() => parseSquare(ruleset.board, sq)).not.toThrow();
  });
});

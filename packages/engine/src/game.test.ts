import { describe, expect, it } from "vitest";
import fixtureData from "../test/fixtures/legal.json";
import { catalog } from "./catalog";
import { inCheck, legalMoves, makeMove, newGame, play, result, type GameState } from "./game";
import { generateMoves, moveText, startPosition, type Position } from "./moves";
import { resolveRuleset, type Side } from "./rules";

interface Fixture {
  name: string;
  parameters?: Record<string, string>;
  turn: Side;
  ply?: number;
  unmoved?: string[];
  pieces: Partial<Record<Side, Record<string, string>>>;
  check?: boolean;
  status?: string;
  from?: string;
  moves?: string[];
}
const fixtures = (fixtureData as unknown as { positions: Fixture[] }).positions;

function rulesetWith(parameters: Record<string, string> = {}) {
  const c = structuredClone(catalog);
  Object.assign(c.rulesets[0]!.parameters, parameters);
  return resolveRuleset(c, "standard");
}

function position(
  pieces: Fixture["pieces"],
  turn: Side,
  ply = 10,
  unmoved: string[] = [],
): Position {
  const squares: Position["squares"] = {};
  for (const side of ["light", "dark"] as const) {
    for (const [sq, piece] of Object.entries(pieces[side] ?? {})) squares[sq] = { side, piece };
  }
  return { squares, turn, ply, unmoved };
}

describe("legal move fixtures", () => {
  for (const f of fixtures) {
    it(f.name, () => {
      const ruleset = rulesetWith(f.parameters);
      const pos = position(f.pieces, f.turn, f.ply, f.unmoved);
      if (f.check !== undefined) expect(inCheck(ruleset, pos)).toBe(f.check);
      if (f.status) {
        const r = result(ruleset, newGame(ruleset, pos));
        expect(r.status === "draw" ? r.reason : r.status).toBe(f.status);
      }
      if (f.moves) {
        const moves = legalMoves(ruleset, pos).filter(
          (m) => f.from === undefined || m.from === f.from,
        );
        expect(moves.map(moveText).sort()).toEqual([...f.moves].sort());
      }
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

describe("legal moves", () => {
  const ruleset = rulesetWith();

  it("start position: every pseudo-legal move is legal", () => {
    const setup = ruleset.setup.default.pieces;
    const pos = startPosition(ruleset, setup, setup);
    expect(legalMoves(ruleset, pos)).toEqual(generateMoves(ruleset, pos));
  });

  it("makeMove moves, captures, promotes, and passes the turn", () => {
    const pos = position(
      { light: { h1: "king", b8: "pawn" }, dark: { a8: "rook", h8: "king" } },
      "light",
      10,
      ["b8", "a8"],
    );
    const next = makeMove(pos, {
      from: "b8",
      to: "a8",
      piece: "pawn",
      captured: "rook",
      promotion: "queen",
    });
    expect(next.squares.a8).toEqual({ side: "light", piece: "queen" });
    expect(next.squares.b8).toBeUndefined();
    expect(next.turn).toBe("dark");
    expect(next.ply).toBe(11);
    expect(next.unmoved).toEqual([]);
    expect(pos.squares.b8).toEqual({ side: "light", piece: "pawn" });
  });

  it("checkmate names the winner", () => {
    const pos = position({ light: { h1: "king" }, dark: { f3: "king", g2: "queen" } }, "light");
    expect(result(ruleset, newGame(ruleset, pos))).toEqual({ status: "checkmate", winner: "dark" });
  });
});

describe("play and draws (D8)", () => {
  const ruleset = rulesetWith();
  const move = (game: GameState, text: string) => {
    const m = legalMoves(ruleset, game.position).find((x) => moveText(x) === text);
    if (!m) throw new Error(`no legal move ${text}`);
    return play(ruleset, game, m);
  };

  it("refuses an illegal move", () => {
    const game = newGame(
      ruleset,
      position({ light: { h1: "king" }, dark: { a8: "king", g8: "rook" } }, "light"),
    );
    expect(() => play(ruleset, game, { from: "h1", to: "g1", piece: "king" })).toThrow(/illegal/);
  });

  it("threefold repetition, counting the starting position", () => {
    let game = newGame(
      ruleset,
      position(
        { light: { h1: "king", b1: "knight" }, dark: { a8: "king", b8: "knight" } },
        "light",
      ),
    );
    const cycle = ["b1-c3", "b8-c6", "c3-b1", "c6-b8"];
    for (const text of [...cycle, ...cycle.slice(0, 3)]) {
      game = move(game, text);
      expect(result(ruleset, game).status).toBe("ongoing");
    }
    game = move(game, "c6-b8");
    expect(result(ruleset, game)).toEqual({ status: "draw", reason: "repetition" });
  });

  const quiet = (pieces: Fixture["pieces"], plies: number): GameState => ({
    ...newGame(ruleset, position(pieces, "light")),
    quietPlies: plies,
  });
  const rookEnding = {
    light: { h1: "king", b2: "rook", e4: "pawn" },
    dark: { a8: "king", e5: "knight" },
  };

  it("fifty-move rule: fifty moves each with no capture and no pawn move", () => {
    const game = move(quiet(rookEnding, 99), "h1-g1");
    expect(game.quietPlies).toBe(100);
    expect(result(ruleset, game)).toEqual({ status: "draw", reason: "moveRule" });
  });

  it("fifty-move rule: a pawn move or a capture resets the count", () => {
    expect(move(quiet(rookEnding, 99), "e4-d5").quietPlies).toBe(0);
    expect(move(quiet(rookEnding, 99), "e4xe5").quietPlies).toBe(0);
    expect(result(ruleset, move(quiet(rookEnding, 99), "e4-d5")).status).toBe("ongoing");
  });

  it("checkmate on the hundredth quiet ply wins rather than draws", () => {
    const game = move(
      quiet({ light: { b6: "king", h7: "rook" }, dark: { a8: "king" } }, 99),
      "h7-h8",
    );
    expect(result(ruleset, game)).toEqual({ status: "checkmate", winner: "light" });
    expect(() => play(ruleset, game, { from: "a8", to: "b8", piece: "king" })).toThrow(/over/);
  });

  it("insufficient material after a capture", () => {
    const game = move(
      newGame(
        ruleset,
        position(
          { light: { h1: "king", e4: "knight" }, dark: { a8: "king", d6: "rook" } },
          "light",
        ),
      ),
      "e4xd6",
    );
    expect(result(ruleset, game)).toEqual({ status: "draw", reason: "insufficientMaterial" });
  });
});

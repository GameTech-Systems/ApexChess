import { describe, expect, it } from "vitest";
import { catalog, legalMoves, resolveRuleset, startPosition } from "@apexchess/engine";
import { darkSquareColors, DEFAULT_DARK_SQUARE, promotionChoices, targetsFrom } from "./hotseat";

const ruleset = resolveRuleset(catalog, "standard");
const setup = ruleset.setup.default.pieces;
const pos = startPosition(ruleset, setup, setup);

describe("hot-seat helpers", () => {
  it("lists the legal targets of a selected piece", () => {
    const moves = legalMoves(ruleset, pos);
    const from = moves[0]!.from;
    const targets = targetsFrom(moves, from);
    expect(targets).toEqual(new Set(moves.filter((m) => m.from === from).map((m) => m.to)));
    expect(targets.size).toBeGreaterThan(0);
    expect(targetsFrom(moves, "zz").size).toBe(0);
  });

  it("offers a promotion picker only when several promotions share a move", () => {
    const m = (promotion?: string) => ({ from: "a7", to: "a8", piece: "pawn", promotion });
    const moves = ["queen", "rook", "bishop", "knight"].map(m);
    expect(promotionChoices(moves, "a7", "a8")).toEqual(["queen", "rook", "bishop", "knight"]);
    expect(promotionChoices([m()], "a7", "a8")).toEqual([]);
  });

  it("is black and white by default, with other dark-square colors as options", () => {
    expect(darkSquareColors[DEFAULT_DARK_SQUARE]).toBe("#000000");
    expect(Object.keys(darkSquareColors).length).toBeGreaterThan(1);
  });
});

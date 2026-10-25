import { describe, expect, it } from "vitest";
import { catalog, resolveRuleset } from "@apexchess/engine";
import { middleSquare, pieceDiagram } from "./pieceDiagrams";

const r = resolveRuleset(catalog, "standard");
const sorted = (s: Set<string>) => [...s].sort();

describe("piece diagrams", () => {
  it("puts the piece on the middle of the central ray", () => {
    expect(middleSquare(r, "light")).toBe("e4");
    expect(middleSquare(r, "dark")).toBe("d5");
  });
  it("shows the king's eight neighbours and the knight's eight jumps", () => {
    expect(sorted(pieceDiagram(r, "king").targets)).toEqual(
      ["d3", "d4", "d5", "e3", "e5", "f3", "f4", "f5"].sort(),
    );
    expect(pieceDiagram(r, "knight").targets.size).toBe(8);
  });
  it("shows rooks on files and ranks and bishops on the diagonals", () => {
    const rook = pieceDiagram(r, "rook").targets;
    expect(rook.size).toBe(14);
    expect(rook.has("e8") && rook.has("a4")).toBe(true);
    const bishop = pieceDiagram(r, "bishop").targets;
    expect(bishop.has("a8") && bishop.has("h1") && bishop.has("b1")).toBe(true);
    expect(pieceDiagram(r, "queen").targets.size).toBe(rook.size + bishop.size);
  });
  it("shows the pawn's step ahead along its ray and its two side captures", () => {
    const pawn = pieceDiagram(r, "pawn");
    expect(sorted(pawn.targets)).toEqual(["d4", "d5", "e5"]);
    expect(pawn.position.squares.d4).toEqual({ side: "dark", piece: "pawn" });
    expect(pawn.position.squares.e5).toEqual({ side: "dark", piece: "pawn" });
    expect(pawn.position.squares.d5).toBeUndefined();
  });
});

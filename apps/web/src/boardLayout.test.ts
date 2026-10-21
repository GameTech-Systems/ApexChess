import { catalog, resolveRuleset, startPosition } from "@apexchess/engine";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { Board } from "./Board";
import { squareCenter, squareColor, viewBoxFor } from "./boardLayout";

const ruleset = resolveRuleset(catalog, "standard");
const { board } = ruleset;

describe("diamond layout", () => {
  it("puts each player's own king corner at the bottom center", () => {
    for (const side of ["light", "dark"] as const) {
      const c = squareCenter(board, side, board.sides[side].corner);
      expect(c.x).toBeCloseTo(0);
      expect(c.y).toBeCloseTo(7);
    }
  });

  it("puts the far corner at the top and neighbours on opposite sides of the vertical", () => {
    expect(squareCenter(board, "light", "a8")).toEqual({ x: 0, y: -7 });
    expect(squareCenter(board, "dark", "h1")).toEqual({ x: 0, y: -7 });
    const g1 = squareCenter(board, "light", "g1");
    const h2 = squareCenter(board, "light", "h2");
    expect(g1.x).toBeLessThan(0);
    expect(h2.x).toBeGreaterThan(0);
  });

  it("gives every square a distinct center inside the view box", () => {
    const vb = viewBoxFor(board);
    for (const side of ["light", "dark"] as const) {
      const seen = new Set<string>();
      for (let f = 0; f < board.files; f++)
        for (let r = 0; r < board.ranks; r++) {
          const c = squareCenter(board, side, String.fromCharCode(97 + f) + (r + 1));
          seen.add(`${c.x},${c.y}`);
          expect(Math.abs(c.x) + 1).toBeLessThanOrEqual(vb.half);
          expect(Math.abs(c.y) + 1).toBeLessThanOrEqual(vb.half);
        }
      expect(seen.size).toBe(64);
    }
  });

  it("colors squares by parity, with the light corner light", () => {
    expect(squareColor(board, "h1")).toBe("light");
    expect(squareColor(board, "a8")).toBe("light");
    expect(squareColor(board, "a1")).toBe("dark");
    expect(squareColor(board, "g1")).toBe("dark");
  });
});

describe("Board", () => {
  const setup = ruleset.setup.default.pieces;
  const position = startPosition(ruleset, setup, setup);

  it("renders 64 squares and 32 pieces in both seat views", () => {
    for (const side of ["light", "dark"] as const) {
      const html = renderToStaticMarkup(
        createElement(Board, { board, position, view: side, pieceSet: ruleset.pieces }),
      );
      expect(html.match(/data-square="/g)).toHaveLength(64);
      expect(html.match(/data-piece="/g)).toHaveLength(32);
      expect(html).toContain(`data-view="${side}"`);
    }
  });

  it("labels files and ranks", () => {
    const html = renderToStaticMarkup(
      createElement(Board, { board, position, view: "light", pieceSet: ruleset.pieces }),
    );
    expect(html.match(/data-file-label="/g)).toHaveLength(8);
    expect(html.match(/data-rank-label="/g)).toHaveLength(8);
  });
});

import { describe, expect, it } from "vitest";
import { catalog, resolveRuleset, setupArea } from "@apexchess/engine";
import {
  beyondSquares,
  clearSquare,
  emptySetup,
  fromSeat,
  isLocked,
  placePiece,
  remaining,
  seatSetup,
  setupErrors,
  chordSpan,
  swapPieces,
  withCornerPiece,
  wouldOverfillBeyond,
} from "./setupBuilder";

const r = resolveRuleset(catalog, "standard");
const omit = (p: Record<string, string>, k: string) =>
  Object.fromEntries(Object.entries(p).filter(([sq]) => sq !== k));
const full = r.setup.default.pieces;

describe("setup builder", () => {
  it("counts the army still to place", () => {
    expect(remaining(r, {}).pawn).toBe(8);
    expect(remaining(r, full)).toEqual({
      king: 0,
      queen: 0,
      rook: 0,
      bishop: 0,
      knight: 0,
      pawn: 0,
    });
    expect(remaining(r, { h1: "king", g1: "pawn" }).pawn).toBe(7);
  });
  it("places a piece, moving it if already placed", () => {
    expect(placePiece(r, {}, "g1", "bishop")).toEqual({ g1: "bishop" });
    expect(placePiece(r, { g1: "bishop" }, "f1", "bishop", "g1")).toEqual({ f1: "bishop" });
  });
  it("replaces whatever is on the square", () => {
    expect(placePiece(r, { g1: "bishop" }, "g1", "rook")).toEqual({ g1: "rook" });
  });
  it("refuses squares outside the setup area and pieces beyond the army", () => {
    expect(placePiece(r, {}, "a1", "pawn")).toEqual({});
    expect(placePiece(r, full, "f4", "queen")).toEqual(full);
    expect(placePiece(r, full, "e1", "queen", "g2")).toEqual({ ...omit(full, "g2"), e1: "queen" });
  });
  it("clears a square", () => {
    expect(clearSquare(r, { g1: "bishop", h1: "king" }, "g1")).toEqual({ h1: "king" });
  });
  it("validates live through the engine", () => {
    expect(setupErrors(r, full)).toEqual([]);
    expect(setupErrors(r, {}).length).toBeGreaterThan(0);
    expect(setupArea(r)).toContain("h1");
  });
});

describe("the corner piece is fixed", () => {
  it("starts every setup with the king on its corner, from the ruleset data", () => {
    expect(emptySetup(r)).toEqual({ h1: "king" });
    expect(withCornerPiece(r, {})).toEqual({ h1: "king" });
    expect(withCornerPiece(r, full)).toEqual(full);
  });
  it("moves a king found elsewhere back to the corner, returning the corner's piece to the tray", () => {
    expect(withCornerPiece(r, { g1: "king", h1: "pawn", f1: "rook" })).toEqual({
      h1: "king",
      f1: "rook",
    });
  });
  it("locks only the corner", () => {
    expect(isLocked(r, "h1")).toBe(true);
    expect(isLocked(r, "g1")).toBe(false);
  });
  it("cannot be lifted, covered, or cleared", () => {
    expect(placePiece(r, full, "g1", "king", "h1")).toEqual(full);
    expect(placePiece(r, { h1: "king" }, "h1", "pawn")).toEqual({ h1: "king" });
    expect(clearSquare(r, full, "h1")).toEqual(full);
  });
});

describe("only one piece beyond the front chord", () => {
  it("lists the next chord's squares from the constraints", () => {
    expect(beyondSquares(r).sort()).toEqual(["c1", "d2", "e3", "f4", "g5", "h6"]);
  });
  it("refuses a second piece there and says why", () => {
    const placed = omit(full, "g2");
    expect(wouldOverfillBeyond(r, placed, "c1")).toBe(true);
    expect(placePiece(r, placed, "c1", "queen")).toEqual(placed);
    expect(placePiece(r, full, "c1", "queen", "g2")).toEqual(full);
  });
  it("allows moving or swapping the one piece that is there", () => {
    expect(wouldOverfillBeyond(r, full, "c1", "h6")).toBe(false);
    expect(placePiece(r, full, "c1", "knight", "h6")).toEqual({
      ...omit(full, "h6"),
      c1: "knight",
    });
    const swapped = placePiece(r, omit(full, "g2"), "h6", "queen");
    expect(swapped.h6).toBe("queen");
  });
});

describe("building from dark's seat", () => {
  it("shows a light-frame setup on dark's own squares and maps clicks back", () => {
    const shown = seatSetup(r, "dark", full);
    expect(shown.a8).toBe("king");
    expect(shown.a3).toBe("knight");
    expect(fromSeat(r, "dark", "a8")).toBe("h1");
    expect(fromSeat(r, "dark", "a3")).toBe("h6");
    expect(fromSeat(r, "light", "h6")).toBe("h6");
  });
  it("names dark's squares in its problems", () => {
    const messages = setupErrors(r, { h1: "king", g1: "pawn" }, "dark").map((e) => e.message);
    expect(messages.join(" ")).not.toContain("h1");
    expect(setupErrors(r, full, "dark")).toEqual([]);
  });
});

describe("swapping and naming chords", () => {
  it("swaps two placed pieces, or moves onto an empty square, but never the corner", () => {
    expect(swapPieces(r, full, "g1", "f1")).toEqual({ ...full, g1: "rook", f1: "bishop" });
    const moved = swapPieces(r, omit(full, "c1"), "h6", "c1");
    expect(moved.c1).toBe("knight");
    expect(moved.h6).toBeUndefined();
    expect(swapPieces(r, full, "h1", "g1")).toEqual(full);
    expect(swapPieces(r, full, "g1", "a1")).toEqual(full);
  });
  it("names the front chord and the next one from each seat", () => {
    expect(chordSpan(r, "light", r.setup.constraints.frontChord)).toBe("d1 to h5");
    expect(chordSpan(r, "light", 5)).toBe("c1 to h6");
    expect(chordSpan(r, "dark", 4)).toBe("a4 to e8");
    expect(chordSpan(r, "dark", 5)).toBe("a3 to f8");
  });
});

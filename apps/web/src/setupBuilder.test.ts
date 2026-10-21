import { describe, expect, it } from "vitest";
import { catalog, resolveRuleset, setupArea } from "@apexchess/engine";
import { clearSquare, placePiece, remaining, setupErrors } from "./setupBuilder";

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
    expect(placePiece(r, full, "f4", "queen", "g2")).toEqual({ ...omit(full, "g2"), f4: "queen" });
  });
  it("clears a square", () => {
    expect(clearSquare({ g1: "bishop", h1: "king" }, "g1")).toEqual({ h1: "king" });
  });
  it("validates live through the engine", () => {
    expect(setupErrors(r, full)).toEqual([]);
    expect(setupErrors(r, {}).length).toBeGreaterThan(0);
    expect(setupArea(r)).toContain("h1");
  });
});

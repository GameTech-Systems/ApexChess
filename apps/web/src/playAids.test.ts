import { describe, expect, it } from "vitest";
import { catalog, newRecord, resolveRuleset, startPosition } from "@apexchess/engine";
import { piecesInDanger, undoMoves } from "./playAids";

const ruleset = resolveRuleset(catalog, "standard");
const setup = ruleset.setup.default.pieces;
const record = { ...newRecord(ruleset, setup, setup), moves: ["a", "b", "c"] };

describe("undoMoves", () => {
  it("takes back one move in two-player play", () => {
    expect(undoMoves(record).moves).toEqual(["a", "b"]);
  });
  it("takes back the computer's reply too, so it is the player's turn again", () => {
    expect(undoMoves(record, 0).moves).toEqual(["a", "b"]); // human moves first; takes back "c"
    expect(undoMoves(record, 1).moves).toEqual(["a"]); // human moves second; takes back "c" and "b"
  });
  it("never goes below the start and leaves the record unchanged", () => {
    expect(undoMoves({ ...record, moves: [] }).moves).toEqual([]);
    expect(record.moves).toHaveLength(3);
  });
});

describe("piecesInDanger", () => {
  const pos = startPosition(ruleset, setup, setup);
  it("is empty when nothing is attacked at the start", () => {
    expect(piecesInDanger(ruleset, pos, "light")).toEqual(new Set());
  });
  it("flags an attacked piece with no defender", () => {
    const squares = { ...pos.squares };
    squares["a1"] = { side: "dark", piece: "rook" };
    squares["a3"] = { side: "light", piece: "knight" };
    delete squares["a2"];
    const danger = piecesInDanger(ruleset, { ...pos, squares }, "light");
    expect([...danger].every((s) => squares[s]?.side === "light")).toBe(true);
  });
});

import { describe, expect, it } from "vitest";
import fixtureData from "../test/fixtures/setups.json";
import { catalog } from "./catalog";
import { resolveRuleset } from "./rules";
import { checkSetup, chordOf, placeSetup, type Pieces } from "./setup";

interface Fixture {
  name: string;
  changes: Record<string, string | null>;
  code?: string;
}
const fixtures = fixtureData as unknown as { legal: Fixture[]; illegal: Fixture[] };
const ruleset = resolveRuleset(catalog, "standard");
const { board } = ruleset;

function applyChanges(changes: Record<string, string | null>): Pieces {
  const pieces: Pieces = { ...ruleset.setup.default.pieces };
  for (const [sq, piece] of Object.entries(changes)) {
    if (piece === null) delete pieces[sq];
    else pieces[sq] = piece;
  }
  return pieces;
}

describe("chordOf", () => {
  const cases: [string, "light" | "dark", number][] = [
    ["h1", "light", 0],
    ["g1", "light", 1],
    ["h2", "light", 1],
    ["d1", "light", 4],
    ["h5", "light", 4],
    ["c1", "light", 5],
    ["h6", "light", 5],
    ["a8", "light", 14],
    ["a8", "dark", 0],
    ["e8", "dark", 4],
    ["a4", "dark", 4],
    ["f8", "dark", 5],
    ["a3", "dark", 5],
  ];
  for (const [sq, side, chord] of cases) {
    it(`${sq} is on ${side}'s chord ${chord}`, () => expect(chordOf(board, side, sq)).toBe(chord));
  }

  it("the front chord and the squares behind it hold 15 squares per side", () => {
    for (const side of ["light", "dark"] as const) {
      let n = 0;
      for (let f = 0; f < board.files; f++)
        for (let r = 0; r < board.ranks; r++)
          if (
            chordOf(board, side, String.fromCharCode(97 + f) + (r + 1)) <=
            ruleset.setup.constraints.frontChord
          )
            n++;
      expect(n).toBe(15);
    }
  });
});

describe("placeSetup", () => {
  it("mirrors the default setup through the center for dark", () => {
    expect(placeSetup(board, "dark", ruleset.setup.default.pieces)).toEqual({
      a8: "king",
      b8: "bishop",
      a6: "bishop",
      a7: "rook",
      c8: "rook",
      b7: "queen",
      c6: "knight",
      a3: "knight",
      d8: "pawn",
      c7: "pawn",
      b6: "pawn",
      a5: "pawn",
      e8: "pawn",
      d7: "pawn",
      b5: "pawn",
      a4: "pawn",
    });
  });

  it("leaves light's squares as written", () => {
    expect(placeSetup(board, "light", ruleset.setup.default.pieces)).toEqual(
      ruleset.setup.default.pieces,
    );
  });
});

describe("checkSetup", () => {
  for (const side of ["light", "dark"] as const) {
    for (const f of fixtures.legal) {
      it(`${side}: accepts ${f.name}`, () => {
        expect(checkSetup(ruleset, side, applyChanges(f.changes))).toEqual([]);
      });
    }
    for (const f of fixtures.illegal) {
      it(`${side}: rejects ${f.name}`, () => {
        const codes = checkSetup(ruleset, side, applyChanges(f.changes)).map((e) => e.code);
        expect(codes).toContain(f.code);
      });
    }
  }

  it("follows the constraint data: a wider beyond region accepts a piece two chords out", () => {
    const wider = structuredClone(ruleset);
    wider.setup.constraints.beyondFrontChord.chords = [5, 6];
    expect(checkSetup(wider, "light", applyChanges({ h6: null, h7: "knight" }))).toEqual([]);
  });

  it("follows the constraint data: maxPieces 0 rejects the default setup", () => {
    const none = structuredClone(ruleset);
    none.setup.constraints.beyondFrontChord.maxPieces = 0;
    expect(checkSetup(none, "light", ruleset.setup.default.pieces).map((e) => e.code)).toContain(
      "beyond",
    );
  });
});

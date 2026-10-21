import { describe, expect, it } from "vitest";
import fixtureData from "../test/fixtures/setups.json";
import { catalog } from "./catalog";
import { resolveRuleset } from "./rules";
import { checkSetup, type Pieces } from "./setup";
import { canonicalSetupId, decodeSetup, encodeSetup, mirrorSetup } from "./setupcode";

interface Fixture {
  name: string;
  changes: Record<string, string | null>;
}
const fixtures = fixtureData as unknown as { legal: Fixture[]; illegal: Fixture[] };
const ruleset = resolveRuleset(catalog, "standard");
const { board } = ruleset;
const defaultPieces = ruleset.setup.default.pieces;

function applyChanges(changes: Record<string, string | null>): Pieces {
  const pieces: Pieces = { ...defaultPieces };
  for (const [sq, piece] of Object.entries(changes)) {
    if (piece === null) delete pieces[sq];
    else pieces[sq] = piece;
  }
  return pieces;
}

describe("mirrorSetup", () => {
  it("reflects across the h1 to a8 ray, keeping the king and every chord", () => {
    const m = mirrorSetup(board, "light", { h1: "king", g1: "bishop", h2: "rook", h6: "knight" });
    expect(m).toEqual({ h1: "king", h2: "bishop", g1: "rook", c1: "knight" });
  });

  it("is its own inverse", () => {
    for (const f of fixtures.legal) {
      const p = applyChanges(f.changes);
      expect(mirrorSetup(board, "light", mirrorSetup(board, "light", p))).toEqual(p);
    }
  });

  it("maps legal setups to legal setups", () => {
    for (const f of fixtures.legal) {
      const m = mirrorSetup(board, "light", applyChanges(f.changes));
      expect(checkSetup(ruleset, "light", m)).toEqual([]);
      expect(checkSetup(ruleset, "dark", m)).toEqual([]);
    }
  });

  it("follows the board data: dark's reflection uses its own corner and direction", () => {
    expect(mirrorSetup(board, "dark", { a8: "king", b8: "bishop" })).toEqual({
      a8: "king",
      a7: "bishop",
    });
  });
});

describe("encodeSetup", () => {
  it("writes the default setup chord by chord from the king outward", () => {
    expect(encodeSetup(ruleset, defaultPieces)).toBe("K/BR/RQB/PPPP/PPNPP/5N");
  });

  it("marks empty squares with digits", () => {
    const code = encodeSetup(ruleset, applyChanges({ h6: null, c1: "knight" }));
    expect(code).toBe("K/BR/RQB/PPPP/PPNPP/N5");
  });

  it("refuses a piece outside the setup area", () => {
    expect(() => encodeSetup(ruleset, { ...defaultPieces, h7: "pawn" })).toThrow(/h7/);
  });

  it("refuses a piece the piece set has no letter for", () => {
    expect(() => encodeSetup(ruleset, { ...defaultPieces, h5: "dragon" })).toThrow(/dragon/);
  });
});

describe("decodeSetup", () => {
  it("reads the default code back", () => {
    expect(decodeSetup(ruleset, "K/BR/RQB/PPPP/PPNPP/5N")).toEqual(defaultPieces);
  });

  it("accepts lower case and surrounding spaces", () => {
    expect(decodeSetup(ruleset, " k/br/rqb/pppp/ppnpp/5n ")).toEqual(defaultPieces);
  });

  const bad: [string, string][] = [
    ["wrong chord count", "K/BR/RQB/PPPP/PPNPP"],
    ["short chord", "K/B/RQB/PPPP/PPNPP/5N"],
    ["long chord", "K/BR/RQB/PPPP/PPNPP/6N"],
    ["unknown letter", "K/BR/RQB/PPPP/PPXPP/5N"],
    ["empty text", ""],
    ["zero run", "K/BR/RQB/PPPP/PPNPP/0N5"],
  ];
  for (const [name, code] of bad) {
    it(`rejects ${name}`, () => expect(() => decodeSetup(ruleset, code)).toThrow());
  }

  it("decodes arrangements the validator then rejects", () => {
    const pieces = decodeSetup(ruleset, "B/KR/RQB/PPPP/PPNPP/5N");
    expect(checkSetup(ruleset, "light", pieces).map((e) => e.code)).toContain("corner");
  });
});

describe("codes round-trip", () => {
  for (const f of fixtures.legal) {
    it(`${f.name}`, () => {
      const pieces = applyChanges(f.changes);
      expect(decodeSetup(ruleset, encodeSetup(ruleset, pieces))).toEqual(pieces);
    });
  }

  it("every legal arrangement of the piece beyond the front chord survives", () => {
    for (const piece of ["queen", "rook", "bishop", "knight", "pawn"]) {
      for (const sq of ["c1", "d2", "e3", "f4", "g5", "h6"]) {
        const pieces: Pieces = { ...defaultPieces };
        delete pieces.h6;
        pieces[sq] = piece;
        expect(decodeSetup(ruleset, encodeSetup(ruleset, pieces))).toEqual(pieces);
      }
    }
  });
});

describe("canonicalSetupId", () => {
  it("is the same for a setup and its mirror image", () => {
    for (const f of fixtures.legal) {
      const p = applyChanges(f.changes);
      expect(canonicalSetupId(ruleset, p)).toBe(
        canonicalSetupId(ruleset, mirrorSetup(board, "light", p)),
      );
    }
  });

  it("differs for setups that are not mirror images", () => {
    const a = applyChanges({ h6: null, c1: "knight" });
    const b = applyChanges({ h6: null, d2: "knight" });
    expect(canonicalSetupId(ruleset, a)).not.toBe(canonicalSetupId(ruleset, b));
  });

  it("picks the smaller of the two codes", () => {
    const a = applyChanges({ h6: null, c1: "knight" });
    const codes = [a, mirrorSetup(board, "light", a)].map((p) => encodeSetup(ruleset, p));
    expect(canonicalSetupId(ruleset, a)).toBe([...codes].sort()[0]);
  });

  it("is a setup code, so it decodes back to one of the two mirror images", () => {
    const a = applyChanges({ h6: null, d2: "queen", g2: "knight" });
    const back = decodeSetup(ruleset, canonicalSetupId(ruleset, a));
    expect([a, mirrorSetup(board, "light", a)]).toContainEqual(back);
  });
});

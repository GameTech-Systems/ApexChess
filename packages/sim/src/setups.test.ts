import {
  canonicalSetupId,
  catalog,
  checkSetup,
  chordOf,
  mirrorSetup,
  resolveRuleset,
  seededRandom,
  type ResolvedRuleset,
} from "@apexchess/engine";
import { describe, expect, it } from "vitest";
import { randomSetup, setupFeatures } from "./setups";

const ruleset = resolveRuleset(catalog, "standard");
const { board } = ruleset;
const { frontChord } = ruleset.setup.constraints;

function withConstraints(c: Partial<ResolvedRuleset["setup"]["constraints"]>): ResolvedRuleset {
  return {
    ...ruleset,
    setup: { ...ruleset.setup, constraints: { ...ruleset.setup.constraints, ...c } },
  };
}

describe("randomSetup", () => {
  it("draws setups the ruleset accepts, with the constrained number beyond the front chord", () => {
    for (let seed = 1; seed <= 60; seed++) {
      const pieces = randomSetup(ruleset, seededRandom(seed));
      expect(checkSetup(ruleset, "light", pieces)).toEqual([]);
      const beyond = Object.keys(pieces).filter((sq) => chordOf(board, "light", sq) > frontChord);
      expect(beyond).toHaveLength(ruleset.setup.constraints.beyondFrontChord.maxPieces);
    }
  });

  it("is deterministic per seed and varies across seeds", () => {
    expect(randomSetup(ruleset, seededRandom(7))).toEqual(randomSetup(ruleset, seededRandom(7)));
    const ids = new Set(
      Array.from({ length: 20 }, (_, i) =>
        canonicalSetupId(ruleset, randomSetup(ruleset, seededRandom(i))),
      ),
    );
    expect(ids.size).toBeGreaterThan(15);
  });

  it("puts every non-corner piece beyond the front chord at some seed", () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 200; seed++) {
      const pieces = randomSetup(ruleset, seededRandom(seed));
      for (const [sq, piece] of Object.entries(pieces))
        if (chordOf(board, "light", sq) > frontChord) seen.add(piece);
    }
    expect([...seen].sort()).toEqual(["bishop", "knight", "pawn", "queen", "rook"]);
  });

  it("throws when the constraints leave no legal arrangement", () => {
    expect(() =>
      randomSetup(
        withConstraints({ beyondFrontChord: { chords: [5], maxPieces: 0 } }),
        seededRandom(1),
      ),
    ).toThrow(/no legal arrangement/);
    expect(() => randomSetup(withConstraints({ frontChord: 3 }), seededRandom(1))).toThrow(
      /no legal arrangement/,
    );
  });
});

describe("setupFeatures", () => {
  it("describes the default setup", () => {
    expect(setupFeatures(ruleset, ruleset.setup.default.pieces)).toEqual({
      beyond: "knight",
      chord1: "bishop+rook",
      "chord.queen": "2",
      "front.bishop": "0",
      "front.knight": "1",
      "front.pawn": "4",
      "front.queen": "0",
      "front.rook": "0",
      "sameColor.bishop": "no",
      "sameColor.knight": "no",
      "sameColor.rook": "no",
    });
  });

  it("gives a setup and its mirror image the same features", () => {
    for (let seed = 1; seed <= 30; seed++) {
      const pieces = randomSetup(ruleset, seededRandom(seed));
      expect(setupFeatures(ruleset, mirrorSetup(board, "light", pieces))).toEqual(
        setupFeatures(ruleset, pieces),
      );
    }
  });

  it("detects same-color bishops", () => {
    const pieces = { ...ruleset.setup.default.pieces, g1: "rook", h2: "bishop" };
    expect(setupFeatures(ruleset, pieces)["sameColor.bishop"]).toBe("no");
    const same = { ...ruleset.setup.default.pieces, g1: "queen", g2: "bishop" };
    expect(setupFeatures(ruleset, same)["sameColor.bishop"]).toBe("yes");
    expect(setupFeatures(ruleset, same)["chord.queen"]).toBe("1");
  });
});

import { describe, expect, it } from "vitest";
import {
  addMove,
  catalog,
  checkSetup,
  legalMoves,
  newRecord,
  replay,
  resolveRuleset,
  result,
  type GameRecord,
} from "@apexchess/engine";
import sample from "../../../packages/engine/test/fixtures/sample-game.json";
import { canPlayOn, resumeFrom } from "./playOn";
import { seatOf, setupsForGame } from "./seats";

const ruleset = resolveRuleset(catalog, "standard");
const d = ruleset.setup.default.pieces;
// A second legal arrangement (two pieces swapped), so a mix-up of the sides shows in the tests.
const other = (() => {
  const squares = Object.keys(d);
  for (const a of squares)
    for (const b of squares) {
      if (d[a] === d[b]) continue;
      const swapped = { ...d, [a]: d[b]!, [b]: d[a]! };
      if (
        !checkSetup(ruleset, "light", swapped).length &&
        !checkSetup(ruleset, "dark", swapped).length
      )
        return swapped;
    }
  throw new Error("no second legal setup found");
})();

function played(n: number, light = d, dark = other): GameRecord {
  let rec = newRecord(ruleset, light, dark);
  for (let i = 0; i < n; i++)
    rec = addMove(ruleset, rec, legalMoves(ruleset, replay(ruleset, rec).position)[0]!);
  return rec;
}

describe("canPlayOn", () => {
  it("is true for an ongoing game of the live ruleset, at any step", () => {
    const rec = played(4);
    for (const step of [0, 2, 4]) expect(canPlayOn(ruleset, rec, step)).toBe(true);
  });
  it("is false for a retired ruleset version (D21: no new games on it)", () => {
    const old = resolveRuleset(catalog, "standard", "0.1.0");
    let rec = newRecord(old, d, d);
    rec = addMove(old, rec, legalMoves(old, replay(old, rec).position)[0]!);
    expect(canPlayOn(ruleset, rec, 1)).toBe(false);
  });
  it("is false once the position is over, and for a step out of range", () => {
    // The sample game ends in checkmate; 1.0.0 has the same rules as 0.1.0 (D21).
    const rec = { ...sample, ruleset: { id: "standard", version: "1.0.0" } } as GameRecord;
    expect(result(ruleset, replay(ruleset, rec)).status).toBe("checkmate");
    expect(canPlayOn(ruleset, rec, rec.moves.length)).toBe(false);
    expect(canPlayOn(ruleset, rec, rec.moves.length - 1)).toBe(true);
    expect(canPlayOn(ruleset, played(2), 3)).toBe(false);
    expect(canPlayOn(ruleset, played(2), -1)).toBe(false);
  });
});

describe("resumeFrom", () => {
  it("keeps the first `step` moves and both recorded setups", () => {
    const rec = played(6);
    const r = resumeFrom(rec, 3, "light");
    expect(r.record).toEqual({ ...rec, moves: rec.moves.slice(0, 3) });
    expect(r.record.setups).toEqual(rec.setups);
  });
  it("seats the player on the chosen side, with the game number that puts them there", () => {
    const rec = played(2);
    for (const side of ["light", "dark"] as const) {
      const r = resumeFrom(rec, 2, side);
      expect(seatOf(0, r.game)).toBe(side);
      // The Game's own setup rule gives back the recorded setups, so a rematch alternates sides.
      expect(setupsForGame(r.setups, r.game)).toEqual(rec.setups);
      expect(r.setups[0]).toEqual(rec.setups[side]);
    }
  });
});

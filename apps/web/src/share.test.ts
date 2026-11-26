import { describe, expect, it } from "vitest";
import {
  addMove,
  catalog,
  legalMoves,
  newRecord,
  replay,
  resolveRuleset,
  type GameRecord,
} from "@apexchess/engine";
import { gameLink, parseShare, setupLink } from "./share";

const ruleset = resolveRuleset(catalog, "standard");
const d = ruleset.setup.default.pieces;

function played(n: number): GameRecord {
  let rec = newRecord(ruleset, d, d);
  for (let i = 0; i < n; i++)
    rec = addMove(ruleset, rec, legalMoves(ruleset, replay(ruleset, rec).position)[0]!);
  return rec;
}

describe("share links", () => {
  it("round-trips a setup through the link fragment", () => {
    const link = setupLink(ruleset, d);
    expect(link.startsWith("#setup=")).toBe(true);
    expect(parseShare(ruleset, link)).toEqual({ kind: "setup", pieces: d });
  });
  it("round-trips a game: ruleset, both setups, moves", () => {
    const rec = played(6);
    const link = gameLink(ruleset, rec);
    const got = parseShare(ruleset, link);
    expect(got).toEqual({ kind: "game", record: rec, ruleset });
    expect(rec.moves).toHaveLength(6);
  });
  it("still opens a game recorded under a retired ruleset version, with that version's rules", () => {
    const old = resolveRuleset(catalog, "standard", "0.1.0");
    expect(old.status).toBe("retired");
    let rec = newRecord(old, d, d);
    for (let i = 0; i < 4; i++)
      rec = addMove(old, rec, legalMoves(old, replay(old, rec).position)[0]!);
    const got = parseShare(ruleset, gameLink(old, rec));
    expect(got).toEqual({ kind: "game", record: rec, ruleset: old });
  });
  it("carries no names, tokens, or room codes", () => {
    expect(gameLink(ruleset, played(2))).toMatch(/^#game=[A-Za-z0-9_.~-]+$/);
  });
  it("rejects junk, wrong ruleset versions, and illegal moves", () => {
    expect(parseShare(ruleset, "")).toBeUndefined();
    expect(parseShare(ruleset, "#setup=nonsense")).toBeUndefined();
    expect(parseShare(ruleset, "#game=%%%")).toBeUndefined();
    const rec = played(2);
    const other = { ...rec, ruleset: { id: rec.ruleset.id, version: "0.0.0-x" } };
    expect(parseShare(ruleset, gameLink(ruleset, other))).toBeUndefined();
    const bad = { ...rec, moves: ["a1-a8"] };
    expect(parseShare(ruleset, gameLink(ruleset, bad))).toBeUndefined();
  });
});

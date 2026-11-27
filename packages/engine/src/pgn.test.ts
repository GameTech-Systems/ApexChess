import { describe, expect, it } from "vitest";
import sample from "../test/fixtures/sample-game.json";
import { catalog } from "./catalog";
import { legalMoves, result } from "./game";
import { moveText } from "./moves";
import { parsePgn, toPgn } from "./pgn";
import { addMove, newRecord, replay, type GameRecord } from "./record";
import { resolveRuleset } from "./rules";

const ruleset = resolveRuleset(catalog, "standard");
const setup = ruleset.setup.default.pieces;

function play(n: number, rs = ruleset): GameRecord {
  let rec = newRecord(rs, setup, setup);
  for (let i = 0; i < n; i++) {
    const moves = legalMoves(rs, replay(rs, rec).position);
    rec = addMove(rs, rec, moves[(i * 7) % moves.length]!);
  }
  return rec;
}

describe("PGN export", () => {
  it("writes the provisional D25 tags and numbered moves", () => {
    const text = toPgn(ruleset, play(3));
    expect(text).toContain('[Variant "Apex Chess"]');
    expect(text).toContain(`[Ruleset "${ruleset.id} ${ruleset.version}"]`);
    expect(text).toMatch(/\[LightSetup "[^"]+"\]/);
    expect(text).toMatch(/\[DarkSetup "[^"]+"\]/);
    expect(text).toContain('[Result "*"]');
    expect(text).toMatch(/1\. \S+ \S+\n?.*2\. \S+/s);
  });

  it("round-trips to the same final position", () => {
    for (const n of [0, 1, 2, 25]) {
      const rec = play(n);
      const back = parsePgn(ruleset, toPgn(ruleset, rec));
      expect(back).toEqual(rec);
      expect(replay(ruleset, back).position).toEqual(replay(ruleset, rec).position);
    }
  });

  it("records the result of a finished game", () => {
    const rec = sample as unknown as GameRecord;
    const played = resolveRuleset(catalog, rec.ruleset.id, rec.ruleset.version);
    const text = toPgn(played, rec);
    const res = result(played, replay(played, rec));
    const tag = res.status === "checkmate" ? (res.winner === "light" ? "1-0" : "0-1") : res.status === "draw" ? "1/2-1/2" : "*";
    expect(text).toContain(`[Result "${tag}"]`);
    expect(text.trim().endsWith(tag)).toBe(true);
    expect(parsePgn(played, text).moves).toEqual(rec.moves);
  });

  it("numbers dark-first rulesets from the first mover", () => {
    const dark = { ...ruleset, firstToMove: "dark" as const };
    const rec = play(2, dark);
    expect(toPgn(dark, rec)).toContain(`1... ${rec.moves[0]} 2. ${rec.moves[1]}`);
  });

  it("refuses text that is not an Apex PGN or has the wrong ruleset", () => {
    expect(() => parsePgn(ruleset, "1. e4 e5")).toThrow();
    const text = toPgn(ruleset, play(2)).replace(ruleset.version, "9.9.9");
    expect(() => parsePgn(ruleset, text)).toThrow(/version/);
    expect(() => parsePgn(ruleset, toPgn(ruleset, play(2)).replace(/1\. \S+/, "1. a1-a1"))).toThrow();
  });
});

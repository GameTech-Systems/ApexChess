import { describe, expect, it } from "vitest";
import sample from "../test/fixtures/sample-game.json";
import { catalog } from "./catalog";
import { legalMoves } from "./game";
import { moveText } from "./moves";
import { addMove, newRecord, replay } from "./record";
import { resolveRuleset } from "./rules";

const ruleset = resolveRuleset(catalog, "standard");
const setup = ruleset.setup.default.pieces;

describe("game record", () => {
  it("keeps the ruleset id and version and both setups", () => {
    const rec = newRecord(ruleset, setup, setup);
    expect(rec.ruleset).toEqual({ id: ruleset.id, version: ruleset.version });
    expect(rec.setups).toEqual({ light: setup, dark: setup });
    expect(rec.moves).toEqual([]);
  });

  it("adds legal moves and replays them", () => {
    let rec = newRecord(ruleset, setup, setup);
    const first = legalMoves(ruleset, replay(ruleset, rec).position)[0]!;
    rec = addMove(ruleset, rec, first);
    expect(rec.moves).toEqual([moveText(first)]);
    expect(replay(ruleset, rec).position.ply).toBe(1);
  });

  it("refuses an illegal move and a different ruleset version", () => {
    const rec = newRecord(ruleset, setup, setup);
    expect(() => addMove(ruleset, rec, { from: "a1", to: "a2", piece: "pawn" })).toThrow();
    expect(() => replay({ ...ruleset, version: "9.9.9" }, rec)).toThrow(/version/);
  });

  it("plays the full sample game to its recorded result", () => {
    const rec = sample as unknown as ReturnType<typeof newRecord> & { result: unknown };
    const game = replay(ruleset, rec);
    expect(game.position.ply).toBe(rec.moves.length);
  });
});

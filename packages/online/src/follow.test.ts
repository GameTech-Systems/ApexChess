import { describe, expect, it } from "vitest";
import {
  catalog,
  legalMoves,
  mirrorSetup,
  moveText,
  newRecord,
  replay,
  resolveRuleset,
  type GameRecord,
} from "@apexchess/engine";
import { follow } from "./follow";

const ruleset = resolveRuleset(catalog, "standard");
const setup = catalog.setups[0]!.pieces;

function extend(record: GameRecord, plies: number): GameRecord {
  let game = replay(ruleset, record);
  const moves = [...record.moves];
  for (let i = 0; i < plies; i++) {
    moves.push(moveText(legalMoves(ruleset, game.position)[0]!));
    game = replay(ruleset, { ...record, moves });
  }
  return { ...record, moves };
}

describe("follow", () => {
  const start = newRecord(ruleset, setup, setup);
  const two = extend(start, 2);
  const four = extend(two, 2);

  it("matches a full replay when it builds on an earlier record", () => {
    follow(ruleset, two);
    expect(follow(ruleset, four, two)).toEqual(replay(ruleset, four));
  });

  it("replays when the earlier record is another game", () => {
    const other = {
      ...start,
      setups: { light: mirrorSetup(ruleset.board, "light", setup), dark: setup },
    };
    follow(ruleset, other);
    expect(follow(ruleset, start, other)).toEqual(replay(ruleset, start));
  });

  it("throws on an illegal added move", () => {
    follow(ruleset, two);
    expect(() => follow(ruleset, { ...two, moves: [...two.moves, "a1-a8"] }, two)).toThrow(
      /illegal/,
    );
  });
});

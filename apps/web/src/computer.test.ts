import { describe, expect, it } from "vitest";
import {
  catalog,
  legalMoves,
  moveText,
  newGame,
  resolveRuleset,
  seededRandom,
  startPosition,
} from "@apexchess/engine";
import { computerMove, levels, type Level } from "./computer";

const ruleset = resolveRuleset(catalog, "standard");
const preset = catalog.setups[0]!.pieces;

describe("computerMove", () => {
  for (const level of Object.keys(levels) as Level[]) {
    it(`plays a legal opening move at ${level}`, () => {
      const game = newGame(ruleset, startPosition(ruleset, preset, preset));
      const move = computerMove(ruleset, game, level, seededRandom(1))!;
      expect(legalMoves(ruleset, game.position).map(moveText)).toContain(moveText(move));
    });
  }
});

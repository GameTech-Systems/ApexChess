/** The rules data shipped in `rules/`. Add each new file here; `pnpm validate:rules` checks it against its schema. */
import parameters from "../../../rules/parameters.json";
import standardBoard from "../../../rules/boards/standard.json";
import standardPieces from "../../../rules/pieces/standard.json";
import standardRuleset from "../../../rules/rulesets/standard.json";
import defaultSetup from "../../../rules/setups/default.json";
import type { Board, PieceSet, RulesCatalog, Ruleset, Setup } from "./rules";

export const catalog: RulesCatalog = {
  parameters: parameters.parameters as RulesCatalog["parameters"],
  boards: [standardBoard as Board],
  pieces: [standardPieces as unknown as PieceSet],
  setups: [defaultSetup as Setup],
  rulesets: [standardRuleset as Ruleset],
};

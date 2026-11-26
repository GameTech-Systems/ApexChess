/** The rules data shipped in `rules/`. Add each new file here; `pnpm validate:rules` checks it against its schema. */
import parameters from "../../../rules/parameters.json";
import standardBoard0 from "../../../rules/boards/standard-0.1.0.json";
import standardBoard1 from "../../../rules/boards/standard-1.0.0.json";
import standardPieces0 from "../../../rules/pieces/standard-0.1.0.json";
import standardPieces1 from "../../../rules/pieces/standard-1.0.0.json";
import standardRuleset0 from "../../../rules/rulesets/standard-0.1.0.json";
import standardRuleset1 from "../../../rules/rulesets/standard-1.0.0.json";
import defaultSetup from "../../../rules/setups/default.json";
import type { Board, PieceSet, RulesCatalog, Ruleset, Setup } from "./rules";

/**
 * Oldest first: `resolveRuleset` without a version takes the last match, so the live version of each
 * ruleset id comes last. Retired versions stay so recorded games still replay and count (D21).
 */
export const catalog: RulesCatalog = {
  parameters: parameters.parameters as RulesCatalog["parameters"],
  boards: [standardBoard0 as Board, standardBoard1 as Board],
  pieces: [standardPieces0 as unknown as PieceSet, standardPieces1 as unknown as PieceSet],
  setups: [defaultSetup as Setup],
  rulesets: [standardRuleset0 as Ruleset, standardRuleset1 as Ruleset],
};

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { addMove, catalog, legalMoves, newRecord, replay, resolveRuleset } from "@apexchess/engine";
import { Replay } from "./Replay";

const ruleset = resolveRuleset(catalog, "standard");
const d = ruleset.setup.default.pieces;

describe("Replay", () => {
  it("opens at move 0 and lists every move", () => {
    let rec = newRecord(ruleset, d, d);
    for (let i = 0; i < 3; i++)
      rec = addMove(ruleset, rec, legalMoves(ruleset, replay(ruleset, rec).position)[0]!);
    const html = renderToStaticMarkup(<Replay ruleset={ruleset} record={rec} onClose={() => {}} />);
    expect(html).toContain("Move 0 of 3");
    for (const m of rec.moves) expect(html).toContain(m);
  });
});

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

  const rec = () => {
    let r = newRecord(ruleset, d, d);
    for (let i = 0; i < 2; i++)
      r = addMove(ruleset, r, legalMoves(ruleset, replay(ruleset, r).position)[0]!);
    return r;
  };
  it("offers to play on only when the app gives it a way to", () => {
    const plain = renderToStaticMarkup(
      <Replay ruleset={ruleset} record={rec()} onClose={() => {}} />,
    );
    expect(plain).not.toContain("Play on from here");
    const withPlayOn = renderToStaticMarkup(
      <Replay
        ruleset={ruleset}
        record={rec()}
        onClose={() => {}}
        playOn={{ live: ruleset, start: () => {} }}
      />,
    );
    expect(withPlayOn).toContain("Play on from here");
    expect(withPlayOn).toContain("Two players, one screen");
    expect(withPlayOn).toMatch(/Play the computer/);
    expect(withPlayOn).toMatch(/you play[\s\S]*light[\s\S]*dark/);
  });
  it("does not offer it for a game of a retired ruleset version", () => {
    const old = resolveRuleset(catalog, "standard", "0.1.0");
    let r = newRecord(old, d, d);
    r = addMove(old, r, legalMoves(old, replay(old, r).position)[0]!);
    const html = renderToStaticMarkup(
      <Replay
        ruleset={old}
        record={r}
        onClose={() => {}}
        playOn={{ live: ruleset, start: () => {} }}
      />,
    );
    expect(html).not.toContain("Play on from here");
  });
});

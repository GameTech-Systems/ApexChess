import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { catalog, resolveRuleset, startPosition } from "@apexchess/engine";
import { App } from "./App";
import { Board } from "./Board";

const ruleset = resolveRuleset(catalog, "standard");
const setup = ruleset.setup.default.pieces;
const position = startPosition(ruleset, setup, setup);
const props = { board: ruleset.board, position, view: "light" as const, pieceSet: ruleset.pieces };

describe("Board highlights", () => {
  it("marks the selected square, targets, last move and check", () => {
    const html = renderToStaticMarkup(
      <Board
        {...props}
        selected="h1"
        targets={new Set(["g2", "e4"])}
        lastMove={["h1", "g2"]}
        checked="a8"
      />,
    );
    expect(html.match(/mark-selected/g)).toHaveLength(1);
    expect(html).toContain('data-target="g2"');
    expect(html).toContain("mark-capture");
    expect(html).toContain("mark-target");
    expect(html.match(/mark-last/g)).toHaveLength(2);
    expect(html.match(/mark-check/g)).toHaveLength(1);
  });

  it("draws no marks by default", () => {
    expect(renderToStaticMarkup(<Board {...props} />)).not.toMatch(/mark-/);
  });
});

describe("App", () => {
  it("starts a game with the default setup, light to move, black dark squares", () => {
    const html = renderToStaticMarkup(<App />);
    expect(html).toContain("light to move");
    expect(html).toContain("--sq-dark:#000000");
  });
});

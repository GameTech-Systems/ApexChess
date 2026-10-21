import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { catalog, resolveRuleset, startPosition } from "@apexchess/engine";
import { App, Game } from "./App";
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
  it("opens on the setup builder with the army to place and no game yet", () => {
    const html = renderToStaticMarkup(<App />);
    expect(html).toContain("Player 1: build your setup");
    expect(html).toContain("pawn ×8");
    expect(html).toContain("Choose");
    expect(html).not.toContain("to move");
  });
});

describe("Game", () => {
  it("starts with light to move, black dark squares, and each player's seat", () => {
    const html = renderToStaticMarkup(<Game setups={[setup, setup]} onChangeSetups={() => {}} />);
    expect(html).toContain("light to move");
    expect(html).toContain("--sq-dark:#000000");
    expect(html).toContain("Player 1 plays light, Player 2 plays dark.");
  });
});

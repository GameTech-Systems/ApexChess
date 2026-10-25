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
  it("opens on a choice of opponent and level", () => {
    const html = renderToStaticMarkup(<App />);
    expect(html).toContain("Two players, one screen");
    expect(html).toContain("Play the computer");
    expect(html).toContain("Random moves");
    expect(html).not.toContain("to move");
  });

  it("against the computer, builds only the player's setup", () => {
    const html = renderToStaticMarkup(<App initialMode="computer" />);
    expect(html).toContain("Build your setup");
    expect(html).not.toContain("look away");
  });

  it("in hot seat, opens on the setup builder with the army to place and no game yet", () => {
    const html = renderToStaticMarkup(<App initialMode="hotseat" />);
    expect(html).toContain("Player 1: build your setup");
    expect(html).toContain("pawn ×8");
    expect(html).toContain("Choose");
    expect(html).not.toContain("to move");
  });
});

describe("Home page", () => {
  const html = renderToStaticMarkup(<App />);
  it("welcomes with the headline, the turned board, and how it differs from chess", () => {
    expect(html).toContain("Chess");
    expect(html).toContain("Shifted");
    expect(html).toContain("How it differs from regular chess");
    expect(html).toContain("No castling and no en passant");
    expect(html).toContain("The default setup: light&#x27;s king on h1, dark&#x27;s on a8");
  });
  it("offers the default setup or a custom one", () => {
    expect(html).toContain("Play the default setup");
    expect(html).toContain("Customize your setup");
  });
  it("has a home link with the logo, and legal links in the footer", () => {
    expect(html).toContain('class="brand" href="/"');
    expect(html).toContain('class="logo"');
    expect(html).toContain("Third-party licenses");
    expect(html).toContain("Privacy");
    expect(html).toContain("Terms");
    expect(html).toContain("Apex Chess™");
  });
  it("draws the logo without coordinates", () => {
    const logo = html.slice(html.indexOf('class="logo"'), html.indexOf("</svg>"));
    expect(logo).not.toContain("<text");
    expect(logo.match(/<polygon class="logo-(light|dark)"/g)).toHaveLength(64);
  });
  it("starts straight into a game with the default setup", () => {
    const vs = renderToStaticMarkup(<App initialMode="computer" initialSetup="default" />);
    expect(vs).toContain("light to move");
    expect(vs).not.toContain("Build your setup");
    const hot = renderToStaticMarkup(<App initialMode="hotseat" initialSetup="default" />);
    expect(hot).toContain("Player 1 plays light, Player 2 plays dark.");
  });
});

describe("Setup builder", () => {
  it("fixes the king on its corner and calls out the chord beyond the front chord", () => {
    const html = renderToStaticMarkup(<App initialMode="hotseat" />);
    expect(html).toContain("h1 light king, fixed");
    expect(html).not.toContain("king ×");
    expect(html.match(/class="mark-chord"/g)).toHaveLength(6);
    expect(html).toContain("Only 1 piece on this chord");
  });
});

describe("Play aids", () => {
  it("marks pieces in danger", () => {
    const html = renderToStaticMarkup(<Board {...props} danger={new Set(["h1", "g2"])} />);
    expect(html.match(/mark-danger/g)).toHaveLength(2);
    expect(renderToStaticMarkup(<Board {...props} />)).not.toContain("mark-danger");
  });

  it("offers undo, rules, and the three toggles in a game", () => {
    const html = renderToStaticMarkup(<Game setups={[setup, setup]} onChangeSetups={() => {}} />);
    for (const text of ["Undo", "Rules", "Show legal moves", "Show pieces in danger", "Sound"])
      expect(html).toContain(text);
  });

  it("offers Rules on the opening choice", () => {
    expect(renderToStaticMarkup(<App />)).toContain("Rules");
  });
});

describe("Game", () => {
  it("starts with light to move, black dark squares, and each player's seat", () => {
    const html = renderToStaticMarkup(<Game setups={[setup, setup]} onChangeSetups={() => {}} />);
    expect(html).toContain("light to move");
    expect(html).toContain("--sq-dark:#000000");
    expect(html).toContain("Player 1 plays light, Player 2 plays dark.");
  });

  it("against the computer, names the sides", () => {
    const html = renderToStaticMarkup(
      <Game setups={[setup, setup]} onChangeSetups={() => {}} computer="easy" />,
    );
    expect(html).toContain("You play light, the computer (Easy) plays dark.");
  });
});

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { catalog, resolveRuleset } from "@apexchess/engine";
import { Home } from "./Home";
import { PgnImport } from "./PgnImport";

describe("PgnImport", () => {
  const html = renderToStaticMarkup(<PgnImport onOpen={() => {}} />);
  it("offers a .pgn file picker and a paste box, each labelled", () => {
    expect(html).toMatch(/<input[^>]*type="file"[^>]*accept="[^"]*\.pgn/);
    expect(html).toMatch(/<textarea/);
    expect(html).toMatch(/<label[^>]*>[^<]*Choose a \.pgn file/);
    expect(html).toMatch(/<label[^>]*>[^<]*Or paste the game/);
  });
  it("shows no error before anything is tried", () => {
    expect(html).not.toContain('role="alert"');
  });
  it("is on the home page under More, and works offline", () => {
    const ruleset = resolveRuleset(catalog, "standard");
    const home = renderToStaticMarkup(
      <Home
        ruleset={ruleset}
        onStart={() => {}}
        onOpen={() => {}}
        onEvents={() => {}}
        onImport={() => {}}
        online={false}
      />,
    );
    const more = home.slice(home.indexOf('aria-labelledby="more-title"'));
    expect(more).toContain("Open a PGN game");
    expect(more).not.toMatch(/Open a PGN game[\s\S]{0,300}disabled/);
  });
});

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { catalog, resolveRuleset } from "@apexchess/engine";
import { Rules } from "./Rules";

const ruleset = resolveRuleset(catalog, "standard");
const html = renderToStaticMarkup(<Rules ruleset={ruleset} onClose={() => undefined} />);

describe("Rules screen", () => {
  it("explains the board, the pieces, and The Elbow Room", () => {
    expect(html).toContain("The Elbow Room");
    expect(html).toContain("chord");
    expect(html).toContain("Pawns");
    expect(html).toContain("no castling");
    expect(html).toContain("Close");
  });
  it("does not promise which king sits at the bottom of the view", () => {
    expect(html).toContain("light at h1, dark at a8");
    expect(html).not.toContain("own king at the bottom");
  });
  it("describes how every piece moves, each with a diagram", () => {
    for (const name of ["King", "Queen", "Rook", "Bishop", "Knight", "Pawns"])
      expect(html).toContain(`<h3>${name}</h3>`);
    expect(html.match(/class="piece-guide"/g)).toHaveLength(1);
    expect(html.match(/role="img"/g)).toHaveLength(6);
    expect(html).toContain("Jumps in an L");
  });
  it("explains check, checkmate, draws, and the setup rule from the data", () => {
    expect(html).toContain("checkmate");
    expect(html).toContain("stalemate");
    expect(html).toContain("d1 to h5");
    expect(html).toContain("c1 to h6");
    expect(html).toContain("at h1, dark at a8");
  });
});

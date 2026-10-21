import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Rules } from "./Rules";

describe("Rules screen", () => {
  it("explains the board, the pieces, and The Elbow Room", () => {
    const html = renderToStaticMarkup(<Rules onClose={() => undefined} />);
    expect(html).toContain("The Elbow Room");
    expect(html).toContain("chord");
    expect(html).toContain("Pawns");
    expect(html).toContain("no castling");
    expect(html).toContain("Close");
  });
});

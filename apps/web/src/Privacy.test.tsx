import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Privacy } from "./Privacy";

describe("Privacy screen", () => {
  it("states what is stored and what is not collected", () => {
    const html = renderToStaticMarkup(<Privacy onClose={() => undefined} />);
    expect(html).toContain("Privacy");
    expect(html).toContain("this browser");
    expect(html).toContain("No accounts");
    expect(html).toContain("Close");
    expect(html).toContain("Online games");
    expect(html).toContain("7 days");
  });
});

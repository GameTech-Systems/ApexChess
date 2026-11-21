import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { App } from "./App";

describe("site menu", () => {
  const html = renderToStaticMarkup(<App />);
  it("links every page by its own address", () => {
    for (const path of ["rules", "tournaments", "stats", "leaderboard", "account", "about"])
      expect(html).toContain(`href="/${path}/"`);
  });
  it("shows the Beta Testing badge and no rules draft label", () => {
    expect(html).toContain("Beta Testing");
    expect(html).not.toMatch(/Rules: standard|\(draft\)/);
  });
  it("drops the retired pages", () => {
    for (const path of ["how-to-play", "45-degree-chess", "custom-setups"])
      expect(html).not.toContain(`/${path}/`);
  });
});

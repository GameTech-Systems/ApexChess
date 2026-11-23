import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { App } from "./App";

describe("site menu", () => {
  const html = renderToStaticMarkup(<App />);
  const header = html.slice(html.indexOf("<header"), html.indexOf("</header>"));
  const footer = html.slice(html.indexOf("<footer"));
  it("header links Home, Rules and About only, with no badge", () => {
    for (const path of ["rules", "about"]) expect(header).toContain(`href="/${path}/"`);
    for (const path of ["tournaments", "stats", "leaderboard", "account"])
      expect(header).not.toContain(`/${path}/`);
    expect(header).not.toContain("Beta Testing");
  });
  it("footer has Home and opens the email in a new tab", () => {
    expect(footer).toMatch(/<a href="\/">Home<\/a>/);
    expect(footer).toMatch(/mailto:[^"]+"[^>]*target="_blank"[^>]*rel="noopener noreferrer"/);
  });
  it("shows no Beta Testing badge and no rules draft label", () => {
    expect(html).not.toContain("Beta Testing");
    expect(html).not.toMatch(/Rules: standard|\(draft\)/);
  });
  it("drops the retired pages", () => {
    for (const path of ["how-to-play", "45-degree-chess", "custom-setups"])
      expect(html).not.toContain(`/${path}/`);
  });
});

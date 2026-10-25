import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { catalog, resolveRuleset } from "@apexchess/engine";
import { SetupBuilder } from "./SetupBuilder";

const ruleset = resolveRuleset(catalog, "standard");
const store = { getItem: () => null, setItem: () => undefined };
const render = (side?: "light" | "dark") =>
  renderToStaticMarkup(
    <SetupBuilder
      ruleset={ruleset}
      title="Build"
      presets={[]}
      store={store}
      side={side}
      initial={ruleset.setup.default.pieces}
      onDone={() => undefined}
    />,
  );

describe("SetupBuilder seats", () => {
  it("builds light's setup on light's squares", () => {
    const html = render("light");
    expect(html).toContain('data-view="light"');
    expect(html).toContain("h1 light king, fixed");
    expect(html).toContain('aria-label="h6 light knight"');
    expect(html).toContain("d1 to h5");
  });
  it("builds dark's setup from dark's seat, with dark's own coordinates", () => {
    const html = render("dark");
    expect(html).toContain('data-view="dark"');
    expect(html).toContain("a8 dark king, fixed");
    expect(html).toContain('aria-label="a3 dark knight"');
    expect(html).toContain("fixed on a8");
    expect(html).toContain("a4 to e8");
    expect(html).not.toContain("light king");
  });
  it("is ready when the arrangement is legal", () => {
    expect(render()).toContain("All pieces placed. Ready to play.");
  });
});

import { renderToStaticMarkup } from "react-dom/server";
import { catalog, resolveRuleset } from "@apexchess/engine";
import { About } from "./About";
import { Rules } from "./Rules";
import type { Route } from "./routes";

/** The text of a page as static HTML, for its built file; undefined for pages that need the app. */
export function prerender(route: Route): string | undefined {
  if (route === "rules") {
    const ruleset = resolveRuleset(catalog, "standard");
    return renderToStaticMarkup(
      <main className="page">
        <Rules ruleset={ruleset} />
      </main>,
    );
  }
  if (route === "about")
    return renderToStaticMarkup(
      <main className="page">
        <About />
      </main>,
    );
  return undefined;
}

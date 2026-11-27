import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { catalog, resolveRuleset } from "@apexchess/engine";
import { App } from "./App";
import { Home } from "./Home";
import { Rules } from "./Rules";
import { ROUTE_PATHS, routeOf } from "./routes";
import { Tutorial } from "./Tutorial";
import { lessons } from "./tutorial";

const ruleset = resolveRuleset(catalog, "standard");
const store = { getItem: () => null, setItem: () => undefined };
const render = (lesson = 0, task = 0) =>
  renderToStaticMarkup(
    <Tutorial
      ruleset={ruleset}
      store={store}
      initial={{ lesson, task }}
      onPlay={() => undefined}
      onClose={() => undefined}
    />,
  );

describe("Tutorial", () => {
  it("lists the five lessons and opens on the first, with its board live", () => {
    const html = render();
    for (const l of lessons) expect(html).toContain(l.title.replace("'", "&#x27;"));
    expect(html).toContain("Click light&#x27;s king corner.");
    expect(html).toContain('aria-label="h1 light king"');
    expect(html).toContain('role="group"');
    expect(html).toContain("Lesson 1 of 5");
  });
  it("shows a move task's position from the data", () => {
    const html = render(2, 1);
    expect(html).toContain('aria-label="h5 light pawn"');
    expect(html).toContain('aria-label="g6 dark pawn"');
    expect(html).toContain('aria-label="h6 dark knight"');
    expect(html).toContain("Task 2 of 4");
  });
  it("shows each Player's Choice option on its own board, then the builder", () => {
    const choice = render(4, 0);
    for (const label of ["A", "B", "C"]) expect(choice).toContain(`Arrangement ${label}`);
    expect(render(4, 1)).toContain("d1 to h5");
  });
  it("ends with a game against the easiest computer", () => {
    const html = render(lessons.length, 0);
    expect(html).toContain("Play the computer (Random moves)");
  });
});

describe("tutorial is reachable", () => {
  it("has its own address", () => {
    expect(ROUTE_PATHS.tutorial).toBe("/tutorial/");
    expect(routeOf("/tutorial/")).toBe("tutorial");
  });
  it("from Home", () => {
    const html = renderToStaticMarkup(
      <Home
        ruleset={ruleset}
        onStart={() => undefined}
        onOpen={() => undefined}
        onEvents={() => undefined}
        onImport={() => undefined}
      />,
    );
    expect(html).toContain('href="/tutorial/"');
    expect(renderToStaticMarkup(<App storage={store} />)).toContain('href="/tutorial/"');
  });
  it("from Rules, as a plain link when the page is built and a handler in the app", () => {
    expect(renderToStaticMarkup(<Rules ruleset={ruleset} />)).toContain('href="/tutorial/"');
    expect(
      renderToStaticMarkup(
        <Rules ruleset={ruleset} onClose={() => undefined} onTutorial={() => undefined} />,
      ),
    ).toContain('href="/tutorial/"');
    // Inside a game, leaving for the tutorial would lose the game: no link there.
    expect(
      renderToStaticMarkup(<Rules ruleset={ruleset} onClose={() => undefined} />),
    ).not.toContain('href="/tutorial/"');
  });
});

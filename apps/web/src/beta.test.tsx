import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { About } from "./About";
import { BETA_NOTE, FEEDBACK_QUESTION, FEEDBACK_URL } from "./beta";
import { EventHome } from "./Event";
import { LeaderboardView } from "./Leaderboard";
import { Privacy } from "./Privacy";
import { Rules } from "./Rules";
import { catalog, resolveRuleset } from "@apexchess/engine";

describe("beta labels (D21, D22)", () => {
  it("marks leaderboards and events as Beta", () => {
    expect(renderToStaticMarkup(<LeaderboardView boards={[]} />)).toContain(BETA_NOTE);
    const ev = renderToStaticMarkup(
      <EventHome onCreate={() => undefined} onOpen={() => undefined} onExit={() => undefined} />,
    );
    expect(ev).toContain(BETA_NOTE);
  });
});

describe("live ruleset label (D21)", () => {
  it("shows the ruleset id, version and status from the data on the Rules page", () => {
    const rs = resolveRuleset(catalog, "standard");
    const html = renderToStaticMarkup(<Rules ruleset={rs} onClose={() => undefined} />);
    expect(html).toContain(`${rs.name} ${rs.version}`);
    expect(html).toContain(rs.status === "draft" ? "draft" : rs.status);
    const other = renderToStaticMarkup(
      <Rules ruleset={{ ...rs, version: "9.9.9", status: "official" }} onClose={() => undefined} />,
    );
    expect(other).toContain(`${rs.name} 9.9.9`);
    expect(other).toContain("official");
    expect(other).not.toContain("draft");
  });

  it("publishes standard 1.0.0 as the official rules for the beta", () => {
    const rs = resolveRuleset(catalog, "standard");
    expect(`${rs.version} ${rs.status}`).toBe("1.0.0 official");
    const html = renderToStaticMarkup(<Rules ruleset={rs} onClose={() => undefined} />);
    expect(html).toContain("Apex Chess 1.0.0 (official, set for beta testing)");
  });
});

describe("privacy retention (D23)", () => {
  const html = renderToStaticMarkup(<Privacy onClose={() => undefined} />);
  it("states archived games have no end date", () => {
    expect(html).toContain("kept with no end date");
  });
  it("does not claim the archive cannot be linked back", () => {
    expect(html).not.toContain("cannot be linked back to you");
    expect(html).toContain("could be recognised by someone who knows");
  });
});

describe("beta feedback", () => {
  it("the About page asks the tester question and links both feedback routes", () => {
    const html = renderToStaticMarkup(<About />);
    expect(html).toContain("Beta testing and feedback");
    expect(html).toContain(FEEDBACK_QUESTION);
    expect(html).toContain(`href="${FEEDBACK_URL}"`);
    expect(html).toContain("subject=Apex%20Chess%20beta%20feedback");
  });
});

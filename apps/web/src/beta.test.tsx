import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BETA_NOTE, BetaBadge, rulesLabel } from "./beta";
import { EventHome } from "./Event";
import { LeaderboardView } from "./Leaderboard";
import { Privacy } from "./Privacy";

describe("beta labels (D21, D22)", () => {
  it("shows the ruleset id, version and draft", () => {
    expect(rulesLabel({ id: "standard", version: "0.1.0" })).toBe("Rules: standard v0.1.0 (draft)");
  });
  it("badge says Beta and shows the rules label", () => {
    const html = renderToStaticMarkup(<BetaBadge current={{ id: "standard", version: "0.1.0" }} />);
    expect(html).toContain("Beta");
    expect(html).toContain("standard v0.1.0");
  });
  it("marks leaderboards and events as Beta", () => {
    expect(renderToStaticMarkup(<LeaderboardView boards={[]} />)).toContain(BETA_NOTE);
    const ev = renderToStaticMarkup(
      <EventHome onCreate={() => undefined} onOpen={() => undefined} onExit={() => undefined} />,
    );
    expect(ev).toContain(BETA_NOTE);
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

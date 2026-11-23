import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BETA_NOTE } from "./beta";
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

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LeaderboardView } from "./Leaderboard";

describe("Leaderboard screen (S20d)", () => {
  it("shows each ruleset's board: place, handle, rating, and rated games", () => {
    const html = renderToStaticMarkup(
      <LeaderboardView
        boards={[
          {
            ruleset: "standard",
            players: [
              { handle: "RookLover", rating: 1712, games: 44 },
              { handle: "Other", rating: 1590, games: 31 },
            ],
          },
          { ruleset: "elbow-room", players: [{ handle: "Third", rating: 1655, games: 40 }] },
        ]}
      />,
    );
    expect(html).toContain("standard");
    expect(html).toContain("elbow-room");
    for (const h of ["#", "Handle", "Rating", "Rated games"]) expect(html).toContain(h);
    expect(html).toMatch(/<td>1<\/td><td>RookLover<\/td><td>1712<\/td><td>44<\/td>/);
    expect(html).toMatch(/<td>2<\/td><td>Other<\/td><td>1590<\/td><td>31<\/td>/);
  });

  it("explains who is listed, and says so when nobody is", () => {
    const html = renderToStaticMarkup(<LeaderboardView boards={[]} />);
    expect(html).toContain("No one is listed yet");
    expect(html).toContain("chose to be listed");
    expect(html).toContain("Account page");
  });
});

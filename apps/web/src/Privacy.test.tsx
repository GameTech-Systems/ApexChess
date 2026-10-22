import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Privacy } from "./Privacy";

describe("Privacy screen", () => {
  it("states what is stored and what is not collected", () => {
    const html = renderToStaticMarkup(<Privacy onClose={() => undefined} />);
    expect(html).toContain("Privacy");
    expect(html).toContain("this browser");
    expect(html).toContain("Accounts are optional");
    expect(html).toContain("Close");
    expect(html).toContain("Online games");
    expect(html).toContain("7 days");
  });

  it("describes the anonymous game archive and rate limiting", () => {
    const html = renderToStaticMarkup(<Privacy onClose={() => undefined} />);
    expect(html).toContain("Game archive");
    expect(html).toContain("the day it ended");
    expect(html).toContain("no clock times, room code, ticket, IP address, or time of day");
    expect(html).toContain("the time control");
    expect(html).toContain("time left");
    expect(html).toContain("Games that ended before");
    expect(html).toContain("not stored");
  });

  it("describes events: names, deletion, no indexing, and the token kept here", () => {
    const html = renderToStaticMarkup(<Privacy onClose={() => undefined} />);
    expect(html).toContain("Tournaments");
    expect(html).toContain("not your real name");
    expect(html).toContain("7 days after its last game");
    expect(html).toContain("not listed or indexed");
    expect(html).toContain("without names or the event");
  });

  it("describes accounts: what is kept, no email, the device token, deletion, and reports", () => {
    const html = renderToStaticMarkup(<Privacy onClose={() => undefined} />);
    expect(html).toContain("Accounts");
    expect(html).toContain("No email");
    expect(html).toContain("public key");
    expect(html).toContain("deletes your handle, passkeys, recovery codes, sessions, and ratings");
    expect(html).toContain("Handle reports");
    expect(html).toContain("not who sent it");
  });

  it("describes ratings: what is kept, the room link until deletion, and no game history", () => {
    const html = renderToStaticMarkup(<Privacy onClose={() => undefined} />);
    expect(html).toContain("Ratings");
    expect(html).toContain("rating, how sure it is, how many rated games");
    expect(html).toContain("account id with your seat until the room is deleted");
    expect(html).not.toContain("Games are not linked to accounts");
  });

  it("describes leaderboards: opt-in, what is shown, leaving at once, no indexing", () => {
    const html = renderToStaticMarkup(<Privacy onClose={() => undefined} />);
    expect(html).toContain("Leaderboards");
    expect(html).toContain("only if you turn it on");
    expect(html).toContain("your handle, rating, and number of rated games");
    expect(html).toContain("at once");
    expect(html).toContain("not indexed");
  });
});

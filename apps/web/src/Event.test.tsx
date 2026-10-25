import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { catalog, resolveRuleset } from "@apexchess/engine";
import type { EventView } from "@apexchess/online";
import { App } from "./App";
import { EventHome, EventScreen } from "./Event";

const ruleset = resolveRuleset(catalog, "standard");
const base: EventView = {
  type: "event",
  id: "EVT234",
  ruleset: { id: ruleset.id, version: ruleset.version },
  timeControl: "5+3",
  state: "open",
  players: ["Ana", "Bea", "Cy"],
  games: [],
  standings: [],
  host: false,
};
const screen = (v: Partial<EventView>) =>
  renderToStaticMarkup(
    <EventScreen
      view={{ ...base, ...v }}
      onJoin={() => undefined}
      onStart={() => undefined}
      onPlay={() => undefined}
      onExit={() => undefined}
    />,
  );

const playing: Partial<EventView> = {
  state: "playing",
  format: "roundRobin",
  rounds: 3,
  players: ["Ana", "Bea", "Cy", "Dee"],
  games: [
    [
      { light: 0, dark: 3, score: [1, 0] },
      { light: 1, dark: 2 },
    ],
  ],
  standings: [
    { player: 0, score: 1, tiebreak: 0, rank: 1 },
    { player: 1, score: 0, tiebreak: 0, rank: 2 },
    { player: 2, score: 0, tiebreak: 0, rank: 2 },
    { player: 3, score: 0, tiebreak: 0, rank: 2 },
  ],
};

describe("event start screen", () => {
  it("is offered from the main menu", () => {
    expect(renderToStaticMarkup(<App />)).toContain("Tournaments");
  });

  it("creates an event on a clocked time control, warns against real names, or opens a code", () => {
    const html = renderToStaticMarkup(
      <EventHome onCreate={() => undefined} onOpen={() => undefined} onExit={() => undefined} />,
    );
    expect(html).toContain("Create an event");
    expect(html).toContain("5 + 3");
    expect(html).toContain("1 day per move");
    expect(html).not.toContain("Untimed");
    expect(html).toContain("real name");
    expect(html).toContain("Event code");
  });

  it("puts Back next to the title, and lays the forms out in groups", () => {
    const html = renderToStaticMarkup(
      <EventHome onCreate={() => undefined} onOpen={() => undefined} onExit={() => undefined} />,
    );
    expect(html).toMatch(/<h1>Tournaments<\/h1><button[^>]*>Back<\/button>/);
    expect(html.match(/>Back</g)).toHaveLength(1);
    expect(html.match(/class="form-group"/g)).toHaveLength(2);
    expect(html).not.toContain('class="controls"');
  });
});

describe("event page", () => {
  it("puts Back next to the title", () => {
    const html = screen({});
    expect(html).toMatch(/<h1>Event EVT234<\/h1><button[^>]*>Back<\/button>/);
    expect(html.match(/>Back</g)).toHaveLength(1);
  });

  it("before the start: lists players and lets a visitor join", () => {
    const html = screen({});
    expect(html).toContain("Event EVT234");
    expect(html).toContain("Bea");
    expect(html).toContain("Join");
    expect(html).toContain("real name");
    expect(html).toContain("5 + 3");
  });

  it("the host can start once there are 4 players; others wait", () => {
    expect(screen({ you: 0, host: true })).toMatch(/<button[^>]*disabled[^>]*>Start the event/);
    expect(screen({ you: 0, host: true })).toContain("at least 4");
    const four = screen({ you: 0, host: true, players: ["Ana", "Bea", "Cy", "Dee"] });
    expect(four).not.toMatch(/disabled[^>]*>Start the event/);
    expect(four).toContain("Round robin");
    const guest = screen({ you: 1 });
    expect(guest).toContain("Waiting for Ana to start");
    expect(guest).not.toContain("Join");
  });

  it("while playing: your game, the pairings, standings with Sonneborn-Berger, and the crosstable", () => {
    const html = screen({ ...playing, you: 1, ticket: { room: "R00001", token: "t" } });
    expect(html).toContain("Round 1 of 3");
    expect(html).toContain("Play your game");
    expect(html).toContain("You play light against Cy");
    expect(html).toContain("Ana");
    expect(html).toContain("1–0");
    expect(html).toContain("Sonneborn-Berger");
    expect(html).toContain("Crosstable");
    expect(html).not.toContain("R00001");
  });

  it("says when your game is over or you have the bye", () => {
    expect(screen({ ...playing, you: 0 })).toContain("Your game this round is over");
    const bye = screen({
      ...playing,
      players: ["Ana", "Bea", "Cy", "Dee", "Eve"],
      games: [[{ light: 4, score: [1, 0] }, ...playing.games![0]!]],
      you: 4,
    });
    expect(bye).toContain("You have the bye this round: 1 point");
  });

  it("Swiss events rank by Buchholz; a finished event shows final standings", () => {
    const html = screen({ ...playing, format: "swiss", rounds: 5, state: "over" });
    expect(html).toContain("Swiss");
    expect(html).toContain("Buchholz");
    expect(html).toContain("Final standings");
    expect(html).not.toContain("Play your game");
  });
});

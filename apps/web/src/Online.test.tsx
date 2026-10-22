import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { catalog, mirrorSetup, newRecord, resolveRuleset } from "@apexchess/engine";
import type { RoomView } from "@apexchess/online";
import { App } from "./App";
import { EventLock, EventNoGame, OnlineGame, RoomWaiting } from "./Online";

const ruleset = resolveRuleset(catalog, "standard");
const setup = catalog.setups[0]!.pieces;
const view: RoomView = {
  type: "state",
  room: "ABC234",
  ruleset: { id: ruleset.id, version: ruleset.version },
  setup,
  phase: "playing",
  game: 0,
  side: "dark",
  record: newRecord(ruleset, mirrorSetup(ruleset.board, "light", setup), setup),
  rematch: { you: false, opponent: false },
  opponentOnline: true,
  timeControl: "untimed",
};
const game = (v: Partial<RoomView>) =>
  renderToStaticMarkup(
    <OnlineGame
      view={{ ...view, ...v }}
      ruleset={ruleset}
      send={() => undefined}
      onLeave={() => undefined}
    />,
  );

describe("online play screens", () => {
  it("starts by locking a setup", () => {
    expect(renderToStaticMarkup(<App initialMode="online" />)).toContain("Lock your setup");
  });

  it("shows the room code while waiting, and nothing of the opponent", () => {
    const html = renderToStaticMarkup(
      <RoomWaiting room="ABC234" timeControl="5+3" onLeave={() => undefined} />,
    );
    expect(html).toContain("ABC234");
    expect(html).toContain("hidden");
    expect(html).toContain("5 + 3");
  });

  it("offers resign and draw, never undo", () => {
    const html = game({});
    expect(html).toContain("Resign");
    expect(html).toContain("Offer a draw");
    expect(html).not.toContain("Undo");
    expect(html).toContain("You play dark");
  });

  it("answers a draw offer and an absent opponent", () => {
    const html = game({ drawOffer: "opponent", opponentOnline: false });
    expect(html).toContain("Accept draw");
    expect(html).toContain("Decline");
    expect(html).toContain("offline");
  });

  it("shows both clocks and says an offline opponent's clock keeps running", () => {
    const html = game({
      timeControl: "3+2",
      clock: { light: 61_000, dark: 180_000, running: "light" },
      opponentOnline: false,
    });
    expect(html).toContain("3 + 2");
    expect(html).toContain("1:01");
    expect(html).toContain("3:00");
    expect(html).toContain("clock keeps running");
    expect(game({}).toString()).not.toContain("clock-");
  });

  it("says when a game is rated (S19d)", () => {
    expect(game({ timeControl: "3+2", rated: true })).toContain("Rated game");
    expect(game({ timeControl: "3+2" })).not.toContain("Rated game");
  });

  it("warns when a player is away in an abandonment-only game", () => {
    const html = game({ timeControl: "away5m", away: { who: "opponent", left: 240_000 } });
    expect(html).toContain("4:00");
    expect(html).toContain("Your opponent left");
  });

  it("offers a rematch when the game is over", () => {
    const html = game({
      phase: "over",
      end: { status: "resigned", winner: "dark" },
      rematch: { you: false, opponent: true },
    });
    expect(html).toContain("Your opponent resigned. You win.");
    expect(html).toContain("Rematch");
    expect(html).toContain("wants a rematch");
    expect(html).not.toContain("Resign");
  });
});

describe("event games (D20)", () => {
  const event = { id: "EVT234", round: 1, board: 0 };
  const locking: RoomView = {
    ...view,
    phase: "locking",
    setup: undefined,
    record: undefined,
    event,
    lock: { you: false, opponent: true, left: 300_000 },
  };
  const memory = { getItem: () => null, setItem: () => undefined };

  it("asks for this game's setup, naming your side and the time left", () => {
    const html = renderToStaticMarkup(
      <EventLock
        view={locking}
        ruleset={ruleset}
        presets={[]}
        store={memory}
        send={() => undefined}
        onLeave={() => undefined}
      />,
    );
    expect(html).toContain("Lock your setup for round 2");
    expect(html).toContain("You play dark");
    expect(html).toContain("5:00");
    expect(html).toContain("Your opponent has locked");
  });

  it("waits once your setup is locked", () => {
    const html = renderToStaticMarkup(
      <EventLock
        view={{ ...locking, setup, lock: { you: true, opponent: false, left: 9000 } }}
        ruleset={ruleset}
        presets={[]}
        store={memory}
        send={() => undefined}
        onLeave={() => undefined}
      />,
    );
    expect(html).toContain("Your setup is locked");
    expect(html).toContain("Back to the event");
  });

  it("has no rematch, and leads back to the event", () => {
    const html = game({ phase: "over", end: { status: "resigned", winner: "dark" }, event });
    expect(html).not.toContain("Rematch");
    expect(html).toContain("Back to the event");
    expect(html).toContain("round 2");
  });

  it("explains a game lost before it started", () => {
    const html = renderToStaticMarkup(
      <EventNoGame
        view={{ ...locking, phase: "over", lock: undefined, end: { status: "noShow" } }}
        onLeave={() => undefined}
      />,
    );
    expect(html).toContain("Neither player locked a setup in time");
    expect(html).toContain("Back to the event");
  });
});

describe("returning to a game", () => {
  it("opens the saved room instead of the start screen", () => {
    const saved = JSON.stringify({ room: "ABC234", token: "t" });
    const storage = { getItem: () => saved, setItem: () => undefined };
    expect(renderToStaticMarkup(<App storage={storage} />)).toContain(
      "Connecting to the game server",
    );
  });
});

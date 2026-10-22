import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { catalog, mirrorSetup, newRecord, resolveRuleset } from "@apexchess/engine";
import type { RoomView } from "@apexchess/online";
import { App } from "./App";
import { OnlineGame, RoomWaiting } from "./Online";

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
    const html = renderToStaticMarkup(<RoomWaiting room="ABC234" onLeave={() => undefined} />);
    expect(html).toContain("ABC234");
    expect(html).toContain("hidden");
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

describe("returning to a game", () => {
  it("opens the saved room instead of the start screen", () => {
    const saved = JSON.stringify({ room: "ABC234", token: "t" });
    const storage = { getItem: () => saved, setItem: () => undefined };
    expect(renderToStaticMarkup(<App storage={storage} />)).toContain(
      "Connecting to the game server",
    );
  });
});

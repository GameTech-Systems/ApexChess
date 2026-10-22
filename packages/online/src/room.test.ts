import { describe, expect, it } from "vitest";
import {
  catalog,
  legalMoves,
  mirrorSetup,
  moveText,
  replay,
  resolveRuleset,
  type Pieces,
} from "@apexchess/engine";
import { PROTOCOL, type Lock } from "./protocol";
import {
  RoomError,
  act,
  createRoom,
  joinRoom,
  seatOf,
  sideOf,
  viewFor,
  type RoomData,
} from "./room";

const ruleset = resolveRuleset(catalog, "standard");
const ref = { id: ruleset.id, version: ruleset.version };
const first: Pieces = catalog.setups[0]!.pieces;
const second: Pieces = mirrorSetup(ruleset.board, "light", first);
const lock = (setup: Pieces, over: Partial<Lock> = {}): Lock => ({
  protocol: PROTOCOL,
  ruleset: ref,
  setup,
  ...over,
});
const coin = (value: number) => () => value;

function started(heads = 0.1): RoomData {
  const room = createRoom("ABC234", ruleset, lock(first), "t0");
  return joinRoom(room, ruleset, lock(second), "t1", coin(heads));
}

function code(fn: () => unknown): string | undefined {
  try {
    fn();
  } catch (e) {
    if (e instanceof RoomError) return e.code;
    throw e;
  }
  return undefined;
}

/** The first legal move for the side to move, as the client would send it. */
function nextMove(room: RoomData) {
  const game = replay(ruleset, room.record!);
  return {
    type: "move" as const,
    move: moveText(legalMoves(ruleset, game.position)[0]!),
    ply: room.record!.moves.length,
  };
}
const seatToMove = (room: RoomData) =>
  sideOf(room, 0) === replay(ruleset, room.record!).position.turn ? 0 : 1;

describe("locking setups", () => {
  it("rejects an illegal setup, another ruleset version, and an old protocol", () => {
    const missingKing = Object.fromEntries(Object.entries(first).filter(([sq]) => sq !== "h1"));
    expect(code(() => createRoom("R", ruleset, lock(missingKing), "t"))).toBe("setup");
    expect(
      code(() =>
        createRoom("R", ruleset, lock(first, { ruleset: { ...ref, version: "9.9.9" } }), "t"),
      ),
    ).toBe("ruleset");
    expect(code(() => createRoom("R", ruleset, lock(first, { protocol: 0 }), "t"))).toBe(
      "protocol",
    );
  });

  it("rejects a third player and a joiner on another ruleset version", () => {
    const room = createRoom("R", ruleset, lock(first), "t0");
    expect(
      code(() =>
        joinRoom(
          room,
          ruleset,
          lock(second, { ruleset: { ...ref, version: "0.0.1" } }),
          "t1",
          coin(0),
        ),
      ),
    ).toBe("ruleset");
    expect(code(() => joinRoom(started(), ruleset, lock(second), "t2", coin(0)))).toBe("full");
  });
});

describe("hidden setups (D13)", () => {
  it("shows a waiting player only their own setup", () => {
    const room = createRoom("R", ruleset, lock(first), "t0");
    const view = viewFor(room, 0, false);
    expect(view.phase).toBe("waiting");
    expect(view.setup).toEqual(first);
    expect(view.record).toBeUndefined();
    expect(view.side).toBeUndefined();
    expect(JSON.stringify(view)).not.toContain('"setups"');
  });

  it("reveals both setups at the start, after the coin flip", () => {
    const room = started();
    for (const seat of [0, 1] as const) {
      const view = viewFor(room, seat, true);
      expect(view.phase).toBe("playing");
      expect(view.record!.setups).toEqual(
        sideOf(room, 0) === "light"
          ? { light: first, dark: second }
          : { light: second, dark: first },
      );
      expect(view.record!.ruleset).toEqual(ref);
    }
  });
});

describe("coin flip and sides (D15)", () => {
  it("gives light to either seat by the server's coin", () => {
    expect(sideOf(started(0.1), 0)).toBe("light");
    expect(sideOf(started(0.9), 0)).toBe("dark");
    expect(sideOf(started(0.9), 1)).toBe("light");
  });

  it("alternates sides on rematch once both players ask", () => {
    let room = act(started(0.1), ruleset, 0, { type: "resign" });
    expect(room.end).toEqual({ status: "resigned", winner: "dark" });
    room = act(room, ruleset, 1, { type: "rematch" });
    expect(viewFor(room, 0, true).rematch).toEqual({ you: false, opponent: true });
    expect(room.game).toBe(0);
    room = act(room, ruleset, 0, { type: "rematch" });
    expect(room.game).toBe(1);
    expect(sideOf(room, 0)).toBe("dark");
    expect(room.end).toBeUndefined();
    expect(room.record!.moves).toEqual([]);
    expect(room.record!.setups).toEqual({ light: second, dark: first });
  });

  it("refuses a rematch while the game is on", () => {
    expect(code(() => act(started(), ruleset, 0, { type: "rematch" }))).toBe("notOver");
  });
});

describe("moves", () => {
  it("plays a legal move for the side to move and refuses the other side", () => {
    const room = started();
    const mover = seatToMove(room);
    expect(code(() => act(room, ruleset, (1 - mover) as 0 | 1, nextMove(room)))).toBe("turn");
    const after = act(room, ruleset, mover, nextMove(room));
    expect(after.record!.moves).toHaveLength(1);
  });

  it("refuses an illegal move and a stale ply", () => {
    const room = started();
    const mover = seatToMove(room);
    expect(code(() => act(room, ruleset, mover, { type: "move", move: "a1-a8", ply: 0 }))).toBe(
      "illegal",
    );
    expect(code(() => act(room, ruleset, mover, { ...nextMove(room), ply: 3 }))).toBe("stale");
  });

  it("refuses moves before the start and after the end", () => {
    const waiting = createRoom("R", ruleset, lock(first), "t0");
    expect(code(() => act(waiting, ruleset, 0, { type: "move", move: "a1-a2", ply: 0 }))).toBe(
      "notStarted",
    );
    const over = act(started(), ruleset, 1, { type: "resign" });
    expect(code(() => act(over, ruleset, seatToMove(over), nextMove(over)))).toBe("over");
  });

  it("refuses a game whose ruleset is no longer on the server", () => {
    const room = { ...started(), ruleset: { ...ref, version: "0.0.1" } };
    expect(code(() => act(room, ruleset, 0, { type: "resign" }))).toBe("ruleset");
  });
});

describe("draws by agreement (D8)", () => {
  it("draws when the opponent offers back; a move or a decline clears the offer", () => {
    let room = act(started(), ruleset, 0, { type: "offerDraw" });
    expect(viewFor(room, 1, true).drawOffer).toBe("opponent");
    expect(viewFor(room, 0, true).drawOffer).toBe("you");
    expect(act(room, ruleset, 1, { type: "declineDraw" }).drawOffer).toBeUndefined();
    expect(act(room, ruleset, seatToMove(room), nextMove(room)).drawOffer).toBeUndefined();
    room = act(room, ruleset, 1, { type: "offerDraw" });
    expect(room.end).toEqual({ status: "draw", reason: "agreement" });
    expect(viewFor(room, 0, true).phase).toBe("over");
  });
});

describe("reconnection", () => {
  it("finds the seat by its token only", () => {
    const room = started();
    expect(seatOf(room, "t0")).toBe(0);
    expect(seatOf(room, "t1")).toBe(1);
    expect(seatOf(room, "nope")).toBeUndefined();
  });

  it("gives a returning player the whole game so far", () => {
    let room = started();
    room = act(room, ruleset, seatToMove(room), nextMove(room));
    room = act(room, ruleset, seatToMove(room), nextMove(room));
    const view = viewFor(room, 1, false);
    expect(view.record!.moves).toEqual(room.record!.moves);
    expect(view.opponentOnline).toBe(false);
    expect(replay(ruleset, view.record!).position.ply).toBe(2);
  });
});

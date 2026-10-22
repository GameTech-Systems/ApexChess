/**
 * One online room as plain data, changed only by these functions. Setups are locked on entry and
 * stay hidden until both players are in (D13); then the server flips the coin. The ruleset id and
 * version are locked for the room's games.
 */
import {
  checkSetup,
  legalMoves,
  moveText,
  result,
  type GameRecord,
  type Pieces,
  type Random,
  type ResolvedRuleset,
  type Side,
} from "@apexchess/engine";
import { follow } from "./follow";
import {
  PROTOCOL,
  type ClientMessage,
  type End,
  type ErrorCode,
  type Lock,
  type RoomView,
  type RulesetRef,
} from "./protocol";

export type Seat = 0 | 1;

export interface SeatData {
  /** Secret that lets the player back in after a dropped connection. */
  token: string;
  /** Locked setup, written for light. */
  setup: Pieces;
}

export interface RoomData {
  id: string;
  ruleset: RulesetRef;
  seats: SeatData[];
  /** The coin flip: the seat that plays light in game 0. */
  firstLight?: Seat;
  game: number;
  record?: GameRecord;
  end?: End;
  drawOffer?: Seat;
  rematch: Seat[];
}

export class RoomError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
  ) {
    super(message);
  }
}

const sameRuleset = (ruleset: ResolvedRuleset, ref: RulesetRef) =>
  ruleset.id === ref.id && ruleset.version === ref.version;

function checkLock(ruleset: ResolvedRuleset, lock: Lock): void {
  if (lock.protocol !== PROTOCOL)
    throw new RoomError("protocol", "This page is out of date. Reload to play online.");
  if (!sameRuleset(ruleset, lock.ruleset))
    throw new RoomError(
      "ruleset",
      `This game uses ${ruleset.id}@${ruleset.version}, not ${lock.ruleset.id}@${lock.ruleset.version}. Reload to update.`,
    );
  // The coin has not been flipped yet, so the setup must be legal for either side.
  for (const side of ["light", "dark"] as const) {
    const errors = checkSetup(ruleset, side, lock.setup);
    if (errors.length) throw new RoomError("setup", `Setup not allowed: ${errors[0]!.message}`);
  }
}

/** A room with one player waiting. */
export function createRoom(
  id: string,
  ruleset: ResolvedRuleset,
  lock: Lock,
  token: string,
): RoomData {
  checkLock(ruleset, lock);
  return {
    id,
    ruleset: { id: ruleset.id, version: ruleset.version },
    seats: [{ token, setup: lock.setup }],
    game: 0,
    rematch: [],
  };
}

/** The second player joins; the server flips the coin (`random() < 0.5`: the first seat plays light) and the game starts. */
export function joinRoom(
  room: RoomData,
  ruleset: ResolvedRuleset,
  lock: Lock,
  token: string,
  random: Random,
): RoomData {
  if (room.seats.length >= 2) throw new RoomError("full", "This room already has two players.");
  checkLock(ruleset, lock);
  return startGame({
    ...room,
    seats: [...room.seats, { token, setup: lock.setup }],
    firstLight: random() < 0.5 ? 0 : 1,
  });
}

export function seatOf(room: RoomData, token: string): Seat | undefined {
  const at = room.seats.findIndex((s) => s.token === token);
  return at === 0 || at === 1 ? at : undefined;
}

/** The seat's side in the current game: the coin decides game 0, then sides alternate (D15). */
export function sideOf(room: RoomData, seat: Seat): Side | undefined {
  if (room.firstLight === undefined) return undefined;
  return ((seat === room.firstLight ? 0 : 1) + room.game) % 2 === 0 ? "light" : "dark";
}

const other = (seat: Seat): Seat => (seat === 0 ? 1 : 0);
const opposite = (side: Side): Side => (side === "light" ? "dark" : "light");

function startGame(room: RoomData): RoomData {
  const light = sideOf(room, 0) === "light" ? 0 : 1;
  return {
    ...room,
    record: {
      ruleset: { ...room.ruleset },
      setups: { light: room.seats[light]!.setup, dark: room.seats[other(light)]!.setup },
      moves: [],
    },
    end: undefined,
    drawOffer: undefined,
    rematch: [],
  };
}

/** Apply a player's message. Throws RoomError when it is not allowed; the room is unchanged then. */
export function act(
  room: RoomData,
  ruleset: ResolvedRuleset,
  seat: Seat,
  msg: ClientMessage,
): RoomData {
  if (!sameRuleset(ruleset, room.ruleset))
    throw new RoomError(
      "ruleset",
      `This server no longer plays ${room.ruleset.id}@${room.ruleset.version}.`,
    );
  const record = room.record;
  const side = sideOf(room, seat);
  if (!record || !side) throw new RoomError("notStarted", "The game has not started.");

  if (msg.type === "rematch") {
    if (!room.end) throw new RoomError("notOver", "The game is still on.");
    const rematch = room.rematch.includes(seat) ? room.rematch : [...room.rematch, seat];
    return rematch.length < 2 ? { ...room, rematch } : startGame({ ...room, game: room.game + 1 });
  }
  if (room.end) throw new RoomError("over", "The game is over.");

  switch (msg.type) {
    case "resign":
      return { ...room, end: { status: "resigned", winner: opposite(side) }, drawOffer: undefined };
    case "offerDraw":
      if (room.drawOffer === other(seat))
        return { ...room, end: { status: "draw", reason: "agreement" }, drawOffer: undefined };
      return { ...room, drawOffer: seat };
    case "declineDraw":
      return room.drawOffer === other(seat) ? { ...room, drawOffer: undefined } : room;
    case "move": {
      const game = follow(ruleset, record);
      if (game.position.turn !== side) throw new RoomError("turn", "It is not your move.");
      if (msg.ply !== record.moves.length)
        throw new RoomError("stale", "That move was for an earlier position.");
      const move = legalMoves(ruleset, game.position).find((m) => moveText(m) === msg.move);
      if (!move) throw new RoomError("illegal", `${msg.move} is not a legal move.`);
      const next = { ...record, moves: [...record.moves, msg.move] };
      const res = result(ruleset, follow(ruleset, next, record));
      return {
        ...room,
        record: next,
        end: res.status === "ongoing" ? undefined : res,
        drawOffer: undefined,
      };
    }
  }
}

/** What one player may see. While waiting there is no record, so nothing of the opponent's setup. */
export function viewFor(room: RoomData, seat: Seat, opponentOnline: boolean): RoomView {
  const side = sideOf(room, seat);
  return {
    type: "state",
    room: room.id,
    ruleset: room.ruleset,
    setup: room.seats[seat]!.setup,
    phase: !room.record ? "waiting" : room.end ? "over" : "playing",
    game: room.game,
    ...(side && { side }),
    ...(room.record && { record: room.record }),
    ...(room.end && { end: room.end }),
    ...(room.drawOffer !== undefined && {
      drawOffer: room.drawOffer === seat ? "you" : "opponent",
    }),
    rematch: { you: room.rematch.includes(seat), opponent: room.rematch.includes(other(seat)) },
    opponentOnline,
  };
}

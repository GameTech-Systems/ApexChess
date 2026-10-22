/**
 * One online room as plain data, changed only by these functions. Setups are locked on entry and
 * stay hidden until both players are in (D13); then the server flips the coin. The ruleset id and
 * version and the time control (D19) are locked for the room's games. Time comes in as `now` (ms).
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
import {
  DEFAULT_TIME_CONTROL,
  clockAfterMove,
  clockDeadline,
  clockLeft,
  startClock,
  timeControl,
  timeoutEnd,
  type ClockData,
  type TimeControl,
} from "./clock";
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
  /** Time control id (D19). */
  timeControl: string;
  /** The current game's clock; absent when the control has none. */
  clock?: ClockData;
  /** Abandonment-only control: the seat that left while the opponent was connected, and when. */
  away?: { seat: Seat; since: number };
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

/** The lock's time control, or the default when it names none. */
export function lockTimeControl(lock: Lock): TimeControl {
  const tc = timeControl(lock.timeControl ?? DEFAULT_TIME_CONTROL);
  if (!tc)
    throw new RoomError("timeControl", "That time control is not offered. Reload to update.");
  return tc;
}

/** A room with one player waiting, on the time control the lock names. */
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
    timeControl: lockTimeControl(lock).id,
  };
}

/**
 * The second player joins on the room's time control; the server flips the coin (`random() < 0.5`:
 * the first seat plays light) and the game and its clock start.
 */
export function joinRoom(
  room: RoomData,
  ruleset: ResolvedRuleset,
  lock: Lock,
  token: string,
  random: Random,
  now: number,
): RoomData {
  if (room.seats.length >= 2) throw new RoomError("full", "This room already has two players.");
  checkLock(ruleset, lock);
  return startGame(
    {
      ...room,
      seats: [...room.seats, { token, setup: lock.setup }],
      firstLight: random() < 0.5 ? 0 : 1,
    },
    ruleset,
    now,
  );
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

const controlOf = (room: RoomData) => timeControl(room.timeControl)!;

function startGame(room: RoomData, ruleset: ResolvedRuleset, now: number): RoomData {
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
    clock: startClock(controlOf(room), ruleset.firstToMove, now),
    away: undefined,
  };
}

/** When the game ends unless someone acts: the running flag, or an absent player's grace time. */
export function deadline(room: RoomData): number | undefined {
  if (!room.record || room.end) return undefined;
  const tc = controlOf(room);
  if (room.clock) return clockDeadline(room.clock);
  if (tc.kind === "abandonment" && room.away) return room.away.since + tc.graceSeconds * 1000;
  return undefined;
}

/** End the game if its deadline has passed at `now`; otherwise the same room. */
export function tick(room: RoomData, ruleset: ResolvedRuleset, now: number): RoomData {
  const due = deadline(room);
  if (due === undefined || now < due) return room;
  const pos = follow(ruleset, room.record!).position;
  const end = room.clock
    ? timeoutEnd(ruleset, pos, room.clock.running, "time")
    : timeoutEnd(ruleset, pos, sideOf(room, room.away!.seat)!, "abandoned");
  const clock = room.clock && { ...room.clock, ...clockLeft(room.clock, now), since: now };
  return { ...room, end, drawOffer: undefined, clock, away: undefined };
}

/**
 * Who is connected, for the abandonment-only control: an absence counts only while the game is on
 * and the opponent is connected. Other controls ignore it; their clocks keep running.
 */
export function presence(room: RoomData, online: [boolean, boolean], now: number): RoomData {
  if (!room.record || room.end || controlOf(room).kind !== "abandonment") return room;
  const gone = online[0] === online[1] ? undefined : online[0] ? 1 : 0;
  if (gone === room.away?.seat) return room;
  return { ...room, away: gone === undefined ? undefined : { seat: gone, since: now } };
}

/**
 * Apply a player's message at `now`. Throws RoomError when it is not allowed; the room is unchanged
 * then. If time ran out first, the game ends on time and the message is dropped.
 */
export function act(
  room: RoomData,
  ruleset: ResolvedRuleset,
  seat: Seat,
  msg: ClientMessage,
  now: number,
): RoomData {
  if (!sameRuleset(ruleset, room.ruleset))
    throw new RoomError(
      "ruleset",
      `This server no longer plays ${room.ruleset.id}@${room.ruleset.version}.`,
    );
  const timed = tick(room, ruleset, now);
  if (timed !== room && msg.type !== "rematch") return timed;
  room = timed;
  const record = room.record;
  const side = sideOf(room, seat);
  if (!record || !side) throw new RoomError("notStarted", "The game has not started.");

  if (msg.type === "rematch") {
    if (!room.end) throw new RoomError("notOver", "The game is still on.");
    const rematch = room.rematch.includes(seat) ? room.rematch : [...room.rematch, seat];
    return rematch.length < 2
      ? { ...room, rematch }
      : startGame({ ...room, game: room.game + 1 }, ruleset, now);
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
      const end = res.status === "ongoing" ? undefined : res;
      const clock = room.clock && clockAfterMove(controlOf(room), room.clock, now);
      return { ...room, record: next, end, drawOffer: undefined, clock };
    }
  }
}

/** What one player may see at `now`. While waiting there is no record, so nothing of the opponent's setup. */
export function viewFor(
  room: RoomData,
  seat: Seat,
  opponentOnline: boolean,
  now: number,
): RoomView {
  const side = sideOf(room, seat);
  const { clock, away } = room;
  const grace = controlOf(room).kind === "abandonment" ? deadline(room) : undefined;
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
    timeControl: room.timeControl,
    ...(clock && {
      clock: { ...clockLeft(clock, now), ...(!room.end && { running: clock.running }) },
    }),
    ...(away &&
      grace !== undefined && {
        away: { who: away.seat === seat ? "you" : "opponent", left: Math.max(0, grace - now) },
      }),
  };
}

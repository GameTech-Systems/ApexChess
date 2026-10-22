/** What clients and the server send each other. Clients get a full room snapshot after every change. */
import type { DrawReason, GameRecord, Pieces, Side } from "@apexchess/engine";

/** Raise when messages change shape; an older client is told to reload. */
export const PROTOCOL = 2;

export interface RulesetRef {
  id: string;
  version: string;
}

/** A locked setup (D13): sent to create or join a room, or to seek a quick match. Written for light. */
export interface Lock {
  protocol: number;
  ruleset: RulesetRef;
  setup: Pieces;
  /** Time control id (D19) for a new room or a quick match; a joiner takes the room's. Default when absent. */
  timeControl?: string;
}

export type End =
  | { status: "checkmate"; winner: Side }
  | { status: "draw"; reason: DrawReason | "agreement" | "time" | "abandoned" }
  | { status: "resigned"; winner: Side }
  /** The loser ran out of time (D19). */
  | { status: "time"; winner: Side }
  /** The loser stayed away past the grace time of an abandonment-only control (D19). */
  | { status: "abandoned"; winner: Side }
  /** Event game: neither player locked a setup in time, so both lose (D20). */
  | { status: "noShow" };

/** Over a room socket. There is no undo online. */
export type ClientMessage =
  | { type: "move"; move: string; ply: number }
  | { type: "resign" }
  | { type: "offerDraw" }
  | { type: "declineDraw" }
  | { type: "rematch" }
  /** Event game: lock this game's setup (D13); sides are already set by pairing (D20). */
  | { type: "lock"; lock: Lock };

export type ErrorCode =
  | "bad"
  | "protocol"
  | "ruleset"
  | "setup"
  | "timeControl"
  | "notFound"
  | "full"
  | "token"
  | "notStarted"
  | "over"
  | "notOver"
  | "busy"
  | "name"
  | "started"
  | "host"
  | "players"
  | "turn"
  | "stale"
  | "illegal"
  /** Accounts (S19c): sign in first or again; a handle already in use. */
  | "signIn"
  | "taken";

/** Which event game a room plays (D20): rounds and boards count from 0. */
export interface EventRef {
  id: string;
  round: number;
  board: number;
}

/** One player's view of a room. */
export interface RoomView {
  type: "state";
  room: string;
  ruleset: RulesetRef;
  /** Your locked setup, written for light. Absent in an event game until you lock it. */
  setup?: Pieces;
  /** "locking": an event game waiting for both players to lock a setup. */
  phase: "waiting" | "locking" | "playing" | "over";
  /** Game number from 0; sides alternate each rematch (D15). */
  game: number;
  /** Your side; set by the coin flip at the start. */
  side?: Side;
  /** Both setups and the moves. Absent while waiting, so the opponent's setup stays hidden. */
  record?: GameRecord;
  end?: End;
  drawOffer?: "you" | "opponent";
  rematch: { you: boolean; opponent: boolean };
  opponentOnline: boolean;
  /** Time control id (D19). */
  timeControl: string;
  /** Time left (ms) when this view was sent; `running` counts down. Absent when untimed. */
  clock?: { light: number; dark: number; running?: Side };
  /** Abandonment-only control: who is away, and ms left before they lose. */
  away?: { who: "you" | "opponent"; left: number };
  /** Event game (D20): the event and its board. There is no rematch. */
  event?: EventRef;
  /** Quick match between two signed-in players: results change both ratings (S19d). */
  rated?: true;
  /** Event game while locking: who has locked, and ms left before an absent player loses. */
  lock?: { you: boolean; opponent: boolean; left: number };
}

export type ServerMessage =
  | RoomView
  | { type: "error"; code: ErrorCode; message: string }
  /** Quick match: waiting for an opponent on the same ruleset. */
  | { type: "seeking" }
  /** Quick match found: open the room socket with this token. */
  | { type: "matched"; room: string; token: string };

/** Room tickets: what `POST /api/rooms` and `.../join` answer. */
export interface Ticket {
  room: string;
  token: string;
}

const MAX_SETUP = 64;
const MAX_TEXT = 32;

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const isText = (v: unknown): v is string => typeof v === "string" && v.length <= MAX_TEXT;

/** A lock's shape (setup legality is the room's job), copied without extra fields; undefined if malformed. */
export function parseLock(value: unknown): Lock | undefined {
  if (!isRecord(value) || typeof value.protocol !== "number") return undefined;
  const { ruleset, setup, timeControl } = value;
  if (timeControl !== undefined && !isText(timeControl)) return undefined;
  if (!isRecord(ruleset) || !isText(ruleset.id) || !isText(ruleset.version)) return undefined;
  if (!isRecord(setup)) return undefined;
  const entries = Object.entries(setup);
  if (entries.length > MAX_SETUP || !entries.every(([k, v]) => isText(k) && isText(v)))
    return undefined;
  return {
    protocol: value.protocol,
    ruleset: { id: ruleset.id, version: ruleset.version },
    setup: Object.fromEntries(entries) as Pieces,
    ...(timeControl !== undefined && { timeControl }),
  };
}

/** A room-socket message from raw text; undefined if malformed or unknown. */
export function parseClientMessage(text: string): ClientMessage | undefined {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return undefined;
  }
  if (!isRecord(value)) return undefined;
  switch (value.type) {
    case "move": {
      const { move, ply } = value;
      if (!isText(move) || !Number.isInteger(ply) || (ply as number) < 0) return undefined;
      return { type: "move", move, ply: ply as number };
    }
    case "resign":
    case "offerDraw":
    case "declineDraw":
    case "rematch":
      return { type: value.type };
    case "lock": {
      const lock = parseLock(value.lock);
      return lock && { type: "lock", lock };
    }
    default:
      return undefined;
  }
}

/** What clients and the server send each other. Clients get a full room snapshot after every change. */
import type { DrawReason, GameRecord, Pieces, Side } from "@apexchess/engine";

/** Raise when messages change shape; an older client is told to reload. */
export const PROTOCOL = 1;

export interface RulesetRef {
  id: string;
  version: string;
}

/** A locked setup (D13): sent to create or join a room, or to seek a quick match. Written for light. */
export interface Lock {
  protocol: number;
  ruleset: RulesetRef;
  setup: Pieces;
}

export type End =
  | { status: "checkmate"; winner: Side }
  | { status: "draw"; reason: DrawReason | "agreement" }
  | { status: "resigned"; winner: Side };

/** Over a room socket. There is no undo online. */
export type ClientMessage =
  | { type: "move"; move: string; ply: number }
  | { type: "resign" }
  | { type: "offerDraw" }
  | { type: "declineDraw" }
  | { type: "rematch" };

export type ErrorCode =
  | "bad"
  | "protocol"
  | "ruleset"
  | "setup"
  | "notFound"
  | "full"
  | "token"
  | "notStarted"
  | "over"
  | "notOver"
  | "busy"
  | "turn"
  | "stale"
  | "illegal";

/** One player's view of a room. */
export interface RoomView {
  type: "state";
  room: string;
  ruleset: RulesetRef;
  /** Your locked setup, written for light. */
  setup: Pieces;
  phase: "waiting" | "playing" | "over";
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
  const { ruleset, setup } = value;
  if (!isRecord(ruleset) || !isText(ruleset.id) || !isText(ruleset.version)) return undefined;
  if (!isRecord(setup)) return undefined;
  const entries = Object.entries(setup);
  if (entries.length > MAX_SETUP || !entries.every(([k, v]) => isText(k) && isText(v)))
    return undefined;
  return {
    protocol: value.protocol,
    ruleset: { id: ruleset.id, version: ruleset.version },
    setup: Object.fromEntries(entries) as Pieces,
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
    default:
      return undefined;
  }
}

import type { Pieces, ResolvedRuleset, Side } from "@apexchess/engine";
import {
  DEFAULT_TIME_CONTROL,
  PROTOCOL,
  timeControl,
  type End,
  type Lock,
  type ServerMessage,
  type Ticket,
} from "@apexchess/online";
import type { KeyValueStore } from "./savedSetups";

const KEY = "apexchess.online.v1";

/** The room this device is playing in, so a reload or a dropped connection can rejoin it. */
export function loadTicket(store: KeyValueStore): Ticket | undefined {
  try {
    const data: unknown = JSON.parse(store.getItem(KEY) || "null");
    const t = data as Partial<Ticket> | null;
    return typeof t?.room === "string" && typeof t?.token === "string"
      ? { room: t.room, token: t.token }
      : undefined;
  } catch {
    return undefined;
  }
}

function write(store: KeyValueStore, value: string): void {
  try {
    store.setItem(KEY, value);
  } catch {
    // Storage blocked: a reload can't rejoin, but the open page still can.
  }
}

export const saveTicket = (store: KeyValueStore, ticket: Ticket) =>
  write(store, JSON.stringify(ticket));
export const clearTicket = (store: KeyValueStore) => write(store, "");

const TC_KEY = "apexchess.timeControl.v1";

/** The time control this device last chose (D19), or the default. */
export function loadTimeControl(store: KeyValueStore): string {
  try {
    const id = store.getItem(TC_KEY);
    return id && timeControl(id) ? id : DEFAULT_TIME_CONTROL;
  } catch {
    return DEFAULT_TIME_CONTROL;
  }
}

export function saveTimeControl(store: KeyValueStore, id: string): void {
  try {
    store.setItem(TC_KEY, id);
  } catch {
    // Storage blocked: the choice lasts for this page only.
  }
}

/** D13: the setup is locked, with this app's ruleset and protocol, before any opponent is found. */
export function lockFor(ruleset: ResolvedRuleset, setup: Pieces, timeControl?: string): Lock {
  return {
    protocol: PROTOCOL,
    ruleset: { id: ruleset.id, version: ruleset.version },
    setup,
    ...(timeControl && { timeControl }),
  };
}

const pad = (n: number) => String(n).padStart(2, "0");

/** "10:00", "0:09.4" in the last ten seconds, "1:02:03", "2d 23:59:59". */
export function clockText(ms: number): string {
  const t = Math.max(0, ms);
  if (t < 10_000) return `0:0${Math.floor(t / 1000)}.${Math.floor((t % 1000) / 100)}`;
  const s = Math.floor(t / 1000);
  const [d, h, m] = [Math.floor(s / 86_400), Math.floor(s / 3600) % 24, Math.floor(s / 60) % 60];
  if (d) return `${d}d ${h}:${pad(m)}:${pad(s % 60)}`;
  if (h) return `${h}:${pad(m)}:${pad(s % 60)}`;
  return `${m}:${pad(s % 60)}`;
}

export const reconnectDelay = (attempt: number) => Math.min(15000, 500 * 2 ** attempt);

export function apiUrl(
  loc: { protocol: string; host: string },
  path: string,
  socket = false,
): string {
  const scheme = socket ? (loc.protocol === "https:" ? "wss:" : "ws:") : loc.protocol;
  return `${scheme}//${loc.host}${path}`;
}

const KNOWN = new Set(["state", "error", "seeking", "matched"]);

export function parseServerMessage(text: string): ServerMessage | undefined {
  try {
    const msg = JSON.parse(text) as ServerMessage;
    return KNOWN.has(msg?.type) ? msg : undefined;
  } catch {
    return undefined;
  }
}

/** POST a locked setup; the server answers a room ticket or an error with a message to show. */
export async function requestTicket(
  fetchFn: (url: string, init: RequestInit) => Promise<Response>,
  url: string,
  lock: Lock,
): Promise<Ticket> {
  let res: Response;
  try {
    res = await fetchFn(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(lock),
    });
  } catch {
    throw new Error("Could not reach the server. Check your connection and try again.");
  }
  const body = (await res.json().catch(() => undefined)) as
    Ticket | Extract<ServerMessage, { type: "error" }> | undefined;
  if (res.ok && body && "token" in body) return body;
  throw new Error(body && "message" in body ? body.message : "The server could not do that.");
}

export function endText(end: End, you: Side): string {
  if (end.status === "draw" && (end.reason === "time" || end.reason === "abandoned"))
    return `Draw: ${end.reason === "time" ? "time ran out" : "a player left"}, but the other side could not checkmate.`;
  if (end.status === "draw")
    return `Draw by ${end.reason === "moveRule" ? "the fifty-move rule" : end.reason === "insufficientMaterial" ? "insufficient material" : end.reason}.`;
  if (end.status === "resigned")
    return end.winner === you ? "Your opponent resigned. You win." : "You resigned.";
  if (end.status === "time")
    return end.winner === you
      ? "Your opponent ran out of time. You win."
      : "You ran out of time. You lose.";
  if (end.status === "abandoned")
    return end.winner === you
      ? "Your opponent left the game. You win."
      : "You were away too long. You lose.";
  return `Checkmate. You ${end.winner === you ? "win" : "lose"}.`;
}

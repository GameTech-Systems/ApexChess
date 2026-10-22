import type { ServerMessage } from "@apexchess/online";
import type { KeyValueStore } from "./savedSetups";

/**
 * Events (D20) open from a link fragment, `#event=CODE`, which the browser never sends to a server.
 * This device keeps the token that proves its player in each event it joined.
 */
export const eventLink = (code: string) => `#event=${code}`;

/** Same alphabet as room codes: no 0, O, 1, I, or L. */
const CODE = /^#event=([2-9A-HJKMNP-Z]{6})$/i;

export function parseEventHash(hash: string): string | undefined {
  return CODE.exec(hash)?.[1]?.toUpperCase();
}

const KEY = "apexchess.events.v1";
/** Events are deleted a week after their last game, so a few recent tokens are enough. */
const KEEP = 20;

function readTokens(store: KeyValueStore): [string, string][] {
  try {
    const data: unknown = JSON.parse(store.getItem(KEY) || "[]");
    return Array.isArray(data)
      ? data.filter(
          (e): e is [string, string] =>
            Array.isArray(e) && typeof e[0] === "string" && typeof e[1] === "string",
        )
      : [];
  } catch {
    return [];
  }
}

export function loadEventToken(store: KeyValueStore, code: string): string | undefined {
  return readTokens(store).find(([c]) => c === code)?.[1];
}

export function saveEventToken(store: KeyValueStore, code: string, token: string): void {
  const list = [...readTokens(store).filter(([c]) => c !== code), [code, token]].slice(-KEEP);
  try {
    store.setItem(KEY, JSON.stringify(list));
  } catch {
    // Storage blocked: this page still knows the token until it closes.
  }
}

/** "2½" for 2.5 points. */
export function pointsText(points: number): string {
  const whole = Math.floor(points);
  if (points === whole) return String(whole);
  return whole ? `${whole}½` : "½";
}

/** Fetch JSON from the api; an error answer or a network failure throws a message to show. */
export async function callApi<T>(
  fetchFn: (url: string, init?: RequestInit) => Promise<Response>,
  url: string,
  init?: RequestInit,
): Promise<T> {
  let res: Response;
  try {
    res = await fetchFn(url, init);
  } catch {
    throw new Error("Could not reach the server. Check your connection and try again.");
  }
  const body = (await res.json().catch(() => undefined)) as
    T | Extract<ServerMessage, { type: "error" }> | undefined;
  const error = body && typeof body === "object" && "type" in body && body.type === "error";
  if (res.ok && body !== undefined && !error) return body as T;
  throw new Error(error ? body.message : "The server could not do that.");
}

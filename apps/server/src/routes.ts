/** Pure helpers for the Worker: api routes, room codes, and error statuses. */
import type { ErrorCode, RulesetRef } from "@apexchess/online";

export type Route =
  | { kind: "create" }
  | { kind: "join"; room: string }
  | { kind: "socket"; room: string }
  | { kind: "match" }
  | { kind: "stats" }
  | { kind: "snapshot"; ruleset: RulesetRef };

/** No 0, O, 1, I, or L, so a code read aloud or typed is hard to get wrong. */
export const ROOM_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const CODE_LENGTH = 6;

/** A room code from random bytes, one character per byte. */
export function roomCode(bytes: Uint8Array): string {
  return Array.from(
    bytes.slice(0, CODE_LENGTH),
    (b) => ROOM_ALPHABET[b % ROOM_ALPHABET.length],
  ).join("");
}

export function normalizeCode(text: string): string | undefined {
  const code = text.trim().toUpperCase();
  return code.length === CODE_LENGTH && [...code].every((c) => ROOM_ALPHABET.includes(c))
    ? code
    : undefined;
}

export function route(method: string, pathname: string): Route | undefined {
  if (pathname === "/api/rooms") return method === "POST" ? { kind: "create" } : undefined;
  if (pathname === "/api/match") return method === "GET" ? { kind: "match" } : undefined;
  if (pathname === "/api/stats") return method === "GET" ? { kind: "stats" } : undefined;
  // Ruleset id and version as rules/schema/rulesets.schema.json allows them.
  const s = /^\/api\/stats\/([a-z][a-z0-9-]*)\/(\d+\.\d+\.\d+)$/.exec(pathname);
  if (s)
    return method === "GET"
      ? { kind: "snapshot", ruleset: { id: s[1]!, version: s[2]! } }
      : undefined;
  const m = /^\/api\/rooms\/([^/]+)\/(join|socket)$/.exec(pathname);
  const room = m && normalizeCode(m[1]!);
  if (!room) return undefined;
  if (m[2] === "join") return method === "POST" ? { kind: "join", room } : undefined;
  return method === "GET" ? { kind: "socket", room } : undefined;
}

export function httpStatus(code: ErrorCode): number {
  if (code === "notFound") return 404;
  if (code === "full") return 409;
  if (code === "busy") return 429;
  return 400;
}

/** Rate limits count requests per connecting address; Cloudflare sets the header. */
export function clientKey(headers: Headers): string {
  return headers.get("cf-connecting-ip") ?? "unknown";
}

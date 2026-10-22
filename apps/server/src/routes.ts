/** Pure helpers for the Worker: api routes, room codes, and error statuses. */
import type { ErrorCode, RulesetRef } from "@apexchess/online";
import type { AccountAction } from "./accounts";

export type Route =
  | { kind: "create" }
  | { kind: "join"; room: string }
  | { kind: "socket"; room: string }
  | { kind: "match" }
  | { kind: "stats" }
  | { kind: "snapshot"; ruleset: RulesetRef }
  | { kind: "newEvent" }
  | { kind: "joinEvent"; event: string }
  | { kind: "startEvent"; event: string }
  | { kind: "event"; event: string }
  | { kind: "account"; action: AccountAction }
  | { kind: "report" };

/** Account paths under /api/account, by method (S19c). */
const ACCOUNT: Record<string, [string, AccountAction]> = {
  "": ["GET", "view"],
  register: ["POST", "register"],
  "register/finish": ["POST", "registerFinish"],
  signin: ["POST", "signIn"],
  "signin/finish": ["POST", "signInFinish"],
  recover: ["POST", "recover"],
  passkey: ["POST", "passkey"],
  "passkey/finish": ["POST", "passkeyFinish"],
  codes: ["POST", "codes"],
  signout: ["POST", "signOut"],
};

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
  if (pathname === "/api/reports") return method === "POST" ? { kind: "report" } : undefined;
  if (pathname === "/api/account" && method === "DELETE")
    return { kind: "account", action: "delete" };
  const a = /^\/api\/account(?:\/(.+))?$/.exec(pathname);
  const entry = a && Object.hasOwn(ACCOUNT, a[1] ?? "") ? ACCOUNT[a[1] ?? ""] : undefined;
  if (a) return entry && entry[0] === method ? { kind: "account", action: entry[1] } : undefined;
  if (pathname === "/api/events") return method === "POST" ? { kind: "newEvent" } : undefined;
  const e = /^\/api\/events\/([^/]+)(?:\/(join|start))?$/.exec(pathname);
  const event = e && normalizeCode(e[1]!);
  if (event) {
    if (!e[2]) return method === "GET" ? { kind: "event", event } : undefined;
    if (method !== "POST") return undefined;
    return e[2] === "join" ? { kind: "joinEvent", event } : { kind: "startEvent", event };
  }
  const m = /^\/api\/rooms\/([^/]+)\/(join|socket)$/.exec(pathname);
  const room = m && normalizeCode(m[1]!);
  if (!room) return undefined;
  if (m[2] === "join") return method === "POST" ? { kind: "join", room } : undefined;
  return method === "GET" ? { kind: "socket", room } : undefined;
}

export function httpStatus(code: ErrorCode): number {
  if (code === "notFound") return 404;
  if (code === "full" || code === "started") return 409;
  if (code === "host") return 403;
  if (code === "busy") return 429;
  if (code === "signIn") return 401;
  if (code === "taken") return 409;
  return 400;
}

/** Rate limits count requests per connecting address; Cloudflare sets the header. */
export function clientKey(headers: Headers): string {
  return headers.get("cf-connecting-ip") ?? "unknown";
}

/** A session token from `Authorization: Bearer <token>` (accounts, S19c). */
export function bearerToken(headers: Headers): string | undefined {
  const m = /^Bearer ([A-Za-z0-9_-]+)$/i.exec(headers.get("authorization") ?? "");
  return m?.[1];
}

const LOCAL = new Set(["localhost", "127.0.0.1"]);

/**
 * The origin and RP ID a passkey must be made for: the page's own origin, which must be this site.
 * A local dev page (Vite on another port) may reach a local server only.
 */
export function passkeyOrigin(req: Request): { origin: string; rpID: string } | undefined {
  const header = req.headers.get("origin");
  let origin: URL;
  try {
    origin = new URL(header ?? "");
  } catch {
    return undefined;
  }
  const self = new URL(req.url);
  const local = LOCAL.has(origin.hostname) && LOCAL.has(self.hostname);
  if (origin.origin !== self.origin && !local) return undefined;
  return { origin: origin.origin, rpID: origin.hostname };
}

import { describe, expect, it } from "vitest";
import {
  ROOM_ALPHABET,
  bearerToken,
  clientKey,
  httpStatus,
  normalizeCode,
  passkeyOrigin,
  roomCode,
  route,
} from "./routes";

describe("api routes", () => {
  it("maps each api path and nothing else", () => {
    expect(route("POST", "/api/rooms")).toEqual({ kind: "create" });
    expect(route("POST", "/api/rooms/ABC234/join")).toEqual({ kind: "join", room: "ABC234" });
    expect(route("GET", "/api/rooms/abc234/socket")).toEqual({ kind: "socket", room: "ABC234" });
    expect(route("GET", "/api/match")).toEqual({ kind: "match" });
    expect(route("GET", "/api/rooms")).toBeUndefined();
    expect(route("POST", "/api/rooms/AB/join")).toBeUndefined();
    expect(route("GET", "/api/rooms/ABC234/../x")).toBeUndefined();
    expect(route("GET", "/index.html")).toBeUndefined();
  });

  it("maps the statistics paths, reading only well-formed ruleset ids and versions", () => {
    expect(route("GET", "/api/stats")).toEqual({ kind: "stats" });
    expect(route("GET", "/api/stats/standard/1.2.0")).toEqual({
      kind: "snapshot",
      ruleset: { id: "standard", version: "1.2.0" },
    });
    expect(route("POST", "/api/stats")).toBeUndefined();
    expect(route("GET", "/api/stats/standard")).toBeUndefined();
    expect(route("GET", "/api/stats/Standard/1.2.0")).toBeUndefined();
    expect(route("GET", "/api/stats/standard/1.2")).toBeUndefined();
    expect(route("GET", "/api/stats/standard/1.2.0/x")).toBeUndefined();
  });
});

describe("event routes (D20)", () => {
  it("maps create, join, start, and view", () => {
    expect(route("POST", "/api/events")).toEqual({ kind: "newEvent" });
    expect(route("POST", "/api/events/evt234/join")).toEqual({
      kind: "joinEvent",
      event: "EVT234",
    });
    expect(route("POST", "/api/events/EVT234/start")).toEqual({
      kind: "startEvent",
      event: "EVT234",
    });
    expect(route("GET", "/api/events/EVT234")).toEqual({ kind: "event", event: "EVT234" });
    expect(route("GET", "/api/events")).toBeUndefined();
    expect(route("GET", "/api/events/EVT234/join")).toBeUndefined();
    expect(route("POST", "/api/events/EVT234")).toBeUndefined();
    expect(route("GET", "/api/events/EVT0/start")).toBeUndefined();
  });
});

describe("account routes (S19c)", () => {
  it("maps each account action to one method", () => {
    const cases: [string, string, string][] = [
      ["POST", "/api/account/register", "register"],
      ["POST", "/api/account/register/finish", "registerFinish"],
      ["POST", "/api/account/signin", "signIn"],
      ["POST", "/api/account/signin/finish", "signInFinish"],
      ["POST", "/api/account/recover", "recover"],
      ["POST", "/api/account/passkey", "passkey"],
      ["POST", "/api/account/passkey/finish", "passkeyFinish"],
      ["POST", "/api/account/codes", "codes"],
      ["POST", "/api/account/signout", "signOut"],
      ["POST", "/api/account/listing", "listing"],
      ["GET", "/api/account", "view"],
      ["DELETE", "/api/account", "delete"],
    ];
    for (const [method, path, action] of cases)
      expect(route(method, path)).toEqual({ kind: "account", action });
    expect(route("GET", "/api/account/register")).toBeUndefined();
    expect(route("POST", "/api/account")).toBeUndefined();
    expect(route("POST", "/api/account/other")).toBeUndefined();
  });

  it("maps the leaderboard path (S20d)", () => {
    expect(route("GET", "/api/leaderboard")).toEqual({ kind: "leaderboard" });
    expect(route("POST", "/api/leaderboard")).toBeUndefined();
    expect(route("GET", "/api/leaderboard/standard")).toBeUndefined();
  });

  it("maps the handle report path", () => {
    expect(route("POST", "/api/reports")).toEqual({ kind: "report" });
    expect(route("GET", "/api/reports")).toBeUndefined();
  });

  it("reads a bearer token and nothing else", () => {
    const h = (v?: string) => new Headers(v ? { authorization: v } : {});
    expect(bearerToken(h("Bearer abc_DEF-123"))).toBe("abc_DEF-123");
    expect(bearerToken(h("bearer abc"))).toBe("abc");
    expect(bearerToken(h("Basic abc"))).toBeUndefined();
    expect(bearerToken(h("Bearer "))).toBeUndefined();
    expect(bearerToken(h())).toBeUndefined();
  });

  it("accepts passkeys only from this site's own origin, or a local dev page", () => {
    const at = (url: string, origin?: string) =>
      passkeyOrigin(new Request(url, { headers: origin ? { origin } : {} }));
    expect(at("https://apexchess.icu/api/account", "https://apexchess.icu")).toEqual({
      origin: "https://apexchess.icu",
      rpID: "apexchess.icu",
    });
    expect(at("http://127.0.0.1:8787/api/account", "http://localhost:5173")).toEqual({
      origin: "http://localhost:5173",
      rpID: "localhost",
    });
    expect(at("https://apexchess.icu/api/account", "https://evil.example")).toBeUndefined();
    expect(at("https://apexchess.icu/api/account", "http://apexchess.icu")).toBeUndefined();
    expect(at("https://apexchess.icu/api/account", "http://localhost:5173")).toBeUndefined();
    expect(at("https://apexchess.icu/api/account")).toBeUndefined();
    expect(at("https://apexchess.icu/api/account", "null")).toBeUndefined();
  });
});

describe("room codes", () => {
  it("are six characters from an alphabet without look-alikes", () => {
    const code = roomCode(Uint8Array.from([0, 1, 30, 31, 255, 128]));
    expect(code).toHaveLength(6);
    expect([...code].every((c) => ROOM_ALPHABET.includes(c))).toBe(true);
    for (const c of "01ILO") expect(ROOM_ALPHABET).not.toContain(c);
  });

  it("accept what a friend types, in any case and with spaces", () => {
    expect(normalizeCode(" abc234 ")).toBe("ABC234");
    expect(normalizeCode("ABC23")).toBeUndefined();
    expect(normalizeCode("ABC2O4")).toBeUndefined();
  });
});

describe("http status for room errors", () => {
  it("says not found, conflict, or bad request", () => {
    expect(httpStatus("notFound")).toBe(404);
    expect(httpStatus("full")).toBe(409);
    expect(httpStatus("setup")).toBe(400);
    expect(httpStatus("busy")).toBe(429);
    expect(httpStatus("started")).toBe(409);
    expect(httpStatus("host")).toBe(403);
    expect(httpStatus("signIn")).toBe(401);
    expect(httpStatus("taken")).toBe(409);
  });
});

describe("rate limit key", () => {
  it("is the connecting address, or one shared key when there is none", () => {
    expect(clientKey(new Headers({ "cf-connecting-ip": "203.0.113.7" }))).toBe("203.0.113.7");
    expect(clientKey(new Headers())).toBe("unknown");
  });
});

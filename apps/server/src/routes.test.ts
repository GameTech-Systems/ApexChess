import { describe, expect, it } from "vitest";
import { ROOM_ALPHABET, clientKey, httpStatus, normalizeCode, roomCode, route } from "./routes";

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
  });
});

describe("rate limit key", () => {
  it("is the connecting address, or one shared key when there is none", () => {
    expect(clientKey(new Headers({ "cf-connecting-ip": "203.0.113.7" }))).toBe("203.0.113.7");
    expect(clientKey(new Headers())).toBe("unknown");
  });
});

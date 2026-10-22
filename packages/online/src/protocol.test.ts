import { describe, expect, it } from "vitest";
import { PROTOCOL, parseClientMessage, parseLock, parseSeek } from "./protocol";

describe("parsing what clients send", () => {
  it("accepts each known message and nothing else", () => {
    expect(parseClientMessage('{"type":"move","move":"h5-g6","ply":0}')).toEqual({
      type: "move",
      move: "h5-g6",
      ply: 0,
    });
    for (const type of ["resign", "offerDraw", "declineDraw", "rematch"])
      expect(parseClientMessage(JSON.stringify({ type }))).toEqual({ type });
    const lock = { protocol: PROTOCOL, ruleset: { id: "standard", version: "0.1.0" }, setup: {} };
    expect(parseClientMessage(JSON.stringify({ type: "lock", lock, x: 1 }))).toEqual({
      type: "lock",
      lock,
    });
    for (const bad of [
      '{"type":"lock"}',
      '{"type":"lock","lock":{"protocol":2}}',
      "not json",
      "null",
      '{"type":"undo"}',
      '{"type":"move","move":7,"ply":0}',
      '{"type":"move","move":"h5-g6","ply":-1}',
      '{"type":"move","move":"h5-g6","ply":1.5}',
      `{"type":"move","move":"${"x".repeat(40)}","ply":0}`,
    ])
      expect(parseClientMessage(bad)).toBeUndefined();
  });

  it("accepts a lock with a plain setup and refuses odd shapes", () => {
    const lock = {
      protocol: PROTOCOL,
      ruleset: { id: "standard", version: "0.1.0" },
      setup: { h1: "king" },
    };
    expect(parseLock(lock)).toEqual(lock);
    expect(parseLock({ ...lock, extra: 1 })).toEqual(lock);
    expect(parseLock({ ...lock, setup: { h1: 3 } })).toBeUndefined();
    expect(parseLock({ ...lock, setup: [] })).toBeUndefined();
    expect(parseLock({ ...lock, ruleset: { id: "standard" } })).toBeUndefined();
    expect(parseLock({ ...lock, protocol: "1" })).toBeUndefined();
    expect(parseLock({ ...lock, timeControl: "3+2" })).toEqual({ ...lock, timeControl: "3+2" });
    expect(parseLock({ ...lock, timeControl: 3 })).toBeUndefined();
    const huge = Object.fromEntries(Array.from({ length: 200 }, (_, i) => [`s${i}`, "pawn"]));
    expect(parseLock({ ...lock, setup: huge })).toBeUndefined();
  });
});

describe("parsing a quick-match seek (S19d)", () => {
  const lock = { protocol: PROTOCOL, ruleset: { id: "standard", version: "0.1.0" }, setup: {} };
  it("reads a lock with an optional session token", () => {
    expect(parseSeek(lock)).toEqual({ lock });
    expect(parseSeek({ ...lock, session: "abc" })).toEqual({ lock, session: "abc" });
  });
  it("refuses a bad lock or a session that is not a short string", () => {
    expect(parseSeek({ session: "abc" })).toBeUndefined();
    expect(parseSeek({ ...lock, session: 5 })).toBeUndefined();
    expect(parseSeek({ ...lock, session: "x".repeat(65) })).toBeUndefined();
  });
});

import { describe, expect, it } from "vitest";
import { PROTOCOL, parseClientMessage, parseLock } from "./protocol";

describe("parsing what clients send", () => {
  it("accepts each known message and nothing else", () => {
    expect(parseClientMessage('{"type":"move","move":"h5-g6","ply":0}')).toEqual({
      type: "move",
      move: "h5-g6",
      ply: 0,
    });
    for (const type of ["resign", "offerDraw", "declineDraw", "rematch"])
      expect(parseClientMessage(JSON.stringify({ type }))).toEqual({ type });
    for (const bad of [
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
    const huge = Object.fromEntries(Array.from({ length: 200 }, (_, i) => [`s${i}`, "pawn"]));
    expect(parseLock({ ...lock, setup: huge })).toBeUndefined();
  });
});

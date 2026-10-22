import { describe, expect, it } from "vitest";
import {
  callApi,
  eventLink,
  loadEventToken,
  parseEventHash,
  pointsText,
  saveEventToken,
} from "./event";
import type { KeyValueStore } from "./savedSetups";

function memory(): KeyValueStore {
  const m = new Map<string, string>();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v) };
}

describe("event links", () => {
  it("round-trips a code in the fragment and refuses anything else", () => {
    expect(eventLink("EVT234")).toBe("#event=EVT234");
    expect(parseEventHash("#event=EVT234")).toBe("EVT234");
    expect(parseEventHash("#event=evt234")).toBe("EVT234");
    expect(parseEventHash("#event=EVT23")).toBeUndefined();
    expect(parseEventHash("#event=EVT2O4")).toBeUndefined();
    expect(parseEventHash("#setup=abc")).toBeUndefined();
    expect(parseEventHash("")).toBeUndefined();
  });
});

describe("event tokens on this device", () => {
  it("keeps one token per event and survives bad data", () => {
    const s = memory();
    expect(loadEventToken(s, "EVT234")).toBeUndefined();
    saveEventToken(s, "EVT234", "tok");
    saveEventToken(s, "ABC234", "other");
    expect(loadEventToken(s, "EVT234")).toBe("tok");
    expect(loadEventToken(s, "ABC234")).toBe("other");
    s.setItem("apexchess.events.v1", "{oops");
    expect(loadEventToken(s, "EVT234")).toBeUndefined();
  });

  it("keeps only the most recent events", () => {
    const s = memory();
    for (let i = 0; i < 30; i++) saveEventToken(s, `E${i}`, `t${i}`);
    expect(loadEventToken(s, "E0")).toBeUndefined();
    expect(loadEventToken(s, "E29")).toBe("t29");
  });

  it("does not throw when storage is blocked", () => {
    const blocked: KeyValueStore = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };
    expect(loadEventToken(blocked, "EVT234")).toBeUndefined();
    expect(() => saveEventToken(blocked, "EVT234", "t")).not.toThrow();
  });
});

describe("points", () => {
  it("shows halves as ½", () => {
    expect(pointsText(0)).toBe("0");
    expect(pointsText(0.5)).toBe("½");
    expect(pointsText(1)).toBe("1");
    expect(pointsText(2.5)).toBe("2½");
  });
});

describe("api calls", () => {
  it("returns the body, or throws the server's message", async () => {
    const ok = async () => new Response(JSON.stringify({ event: "EVT234" }));
    expect(await callApi(ok, "/x")).toEqual({ event: "EVT234" });
    const bad = async () =>
      new Response(JSON.stringify({ type: "error", code: "name", message: "Taken." }), {
        status: 400,
      });
    await expect(callApi(bad, "/x")).rejects.toThrow("Taken.");
    const down = async () => {
      throw new Error("offline");
    };
    await expect(callApi(down, "/x")).rejects.toThrow(/Could not reach/);
  });
});

import { describe, expect, it } from "vitest";
import { catalog, resolveRuleset } from "@apexchess/engine";
import { PROTOCOL } from "@apexchess/online";
import {
  apiUrl,
  clearTicket,
  endText,
  loadTicket,
  lockFor,
  parseServerMessage,
  reconnectDelay,
  requestTicket,
  saveTicket,
} from "./online";

const memory = () => {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
  };
};

describe("the room ticket on this device", () => {
  it("is kept for reconnecting and cleared on leaving", () => {
    const store = memory();
    expect(loadTicket(store)).toBeUndefined();
    saveTicket(store, { room: "ABC234", token: "t" });
    expect(loadTicket(store)).toEqual({ room: "ABC234", token: "t" });
    clearTicket(store);
    expect(loadTicket(store)).toBeUndefined();
  });

  it("reads damaged or blocked storage as none", () => {
    const store = memory();
    store.setItem("apexchess.online.v1", "{nope");
    expect(loadTicket(store)).toBeUndefined();
    const blocked = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };
    expect(loadTicket(blocked)).toBeUndefined();
    expect(() => saveTicket(blocked, { room: "A", token: "t" })).not.toThrow();
  });
});

describe("connections", () => {
  it("waits longer after each failed reconnect, up to a cap", () => {
    expect(reconnectDelay(0)).toBe(500);
    expect(reconnectDelay(1)).toBe(1000);
    expect(reconnectDelay(20)).toBe(15000);
  });

  it("builds http and socket addresses on the page's own host", () => {
    expect(apiUrl({ protocol: "https:", host: "apexchess.icu" }, "/api/rooms")).toBe(
      "https://apexchess.icu/api/rooms",
    );
    expect(apiUrl({ protocol: "https:", host: "apexchess.icu" }, "/api/match", true)).toBe(
      "wss://apexchess.icu/api/match",
    );
    expect(apiUrl({ protocol: "http:", host: "localhost:5173" }, "/api/match", true)).toBe(
      "ws://localhost:5173/api/match",
    );
  });

  it("locks the setup with this app's ruleset id, version, and protocol", () => {
    const ruleset = resolveRuleset(catalog, "standard");
    expect(lockFor(ruleset, { h1: "king" })).toEqual({
      protocol: PROTOCOL,
      ruleset: { id: ruleset.id, version: ruleset.version },
      setup: { h1: "king" },
    });
  });

  it("ignores server messages it does not know", () => {
    expect(parseServerMessage('{"type":"seeking"}')).toEqual({ type: "seeking" });
    expect(parseServerMessage('{"type":"other"}')).toBeUndefined();
    expect(parseServerMessage("junk")).toBeUndefined();
  });

  it("returns the ticket, or throws the server's message", async () => {
    const ok = async () => new Response(JSON.stringify({ room: "ABC234", token: "t" }));
    expect(
      await requestTicket(ok, "/api/rooms", lockFor(resolveRuleset(catalog, "standard"), {})),
    ).toEqual({
      room: "ABC234",
      token: "t",
    });
    const no = async () =>
      new Response(
        JSON.stringify({ type: "error", code: "notFound", message: "No room has that code." }),
        {
          status: 404,
        },
      );
    await expect(
      requestTicket(no, "/x", lockFor(resolveRuleset(catalog, "standard"), {})),
    ).rejects.toThrow("No room has that code.");
    const down = async () => {
      throw new TypeError("fetch failed");
    };
    await expect(
      requestTicket(down, "/x", lockFor(resolveRuleset(catalog, "standard"), {})),
    ).rejects.toThrow(/server/);
  });
});

describe("how a game ended, for each player", () => {
  it("names the winner from the player's side", () => {
    expect(endText({ status: "checkmate", winner: "light" }, "light")).toBe("Checkmate. You win.");
    expect(endText({ status: "checkmate", winner: "light" }, "dark")).toBe("Checkmate. You lose.");
    expect(endText({ status: "resigned", winner: "dark" }, "light")).toBe("You resigned.");
    expect(endText({ status: "resigned", winner: "dark" }, "dark")).toBe(
      "Your opponent resigned. You win.",
    );
    expect(endText({ status: "draw", reason: "agreement" }, "dark")).toBe("Draw by agreement.");
    expect(endText({ status: "draw", reason: "stalemate" }, "dark")).toBe("Draw by stalemate.");
  });
});

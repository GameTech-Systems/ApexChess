import { describe, expect, it } from "vitest";
import { catalog, mirrorSetup, resolveRuleset } from "@apexchess/engine";
import { PROTOCOL, type ClientMessage, type Lock } from "./protocol";
import {
  NEW_RATING,
  glicko2,
  isRated,
  ratedGame,
  ratingText,
  scoreOf,
  type Rating,
} from "./ratings";
import { act, createRoom, joinRoom, sideOf, type RoomData, type Seat } from "./room";

describe("glicko2 (Glickman's worked example)", () => {
  it("matches the paper: 1500/200 beats 1400/30, loses to 1550/100 and 1700/300", () => {
    const player: Rating = { rating: 1500, rd: 200, volatility: 0.06 };
    const next = glicko2(player, [
      { opponent: { rating: 1400, rd: 30, volatility: 0.06 }, score: 1 },
      { opponent: { rating: 1550, rd: 100, volatility: 0.06 }, score: 0 },
      { opponent: { rating: 1700, rd: 300, volatility: 0.06 }, score: 0 },
    ]);
    expect(next.rating).toBeCloseTo(1464.06, 1);
    expect(next.rd).toBeCloseTo(151.52, 1);
    expect(next.volatility).toBeCloseTo(0.05999, 4);
  });

  it("starts new players at 1500, RD 350, volatility 0.06", () => {
    expect(NEW_RATING).toEqual({ rating: 1500, rd: 350, volatility: 0.06 });
  });

  it("moves two new players apart by the same amount after one decisive game", () => {
    const win = glicko2(NEW_RATING, [{ opponent: NEW_RATING, score: 1 }]);
    const loss = glicko2(NEW_RATING, [{ opponent: NEW_RATING, score: 0 }]);
    expect(win.rating).toBeGreaterThan(1500);
    expect(win.rating - 1500).toBeCloseTo(1500 - loss.rating, 6);
    expect(win.rd).toBeLessThan(350);
  });

  it("leaves equal players' ratings alone after a draw", () => {
    expect(glicko2(NEW_RATING, [{ opponent: NEW_RATING, score: 0.5 }]).rating).toBeCloseTo(1500, 6);
  });

  it("never lets RD grow past 350", () => {
    expect(glicko2({ ...NEW_RATING, volatility: 0.5 }, []).rd).toBe(350);
  });
});

describe("ratingText", () => {
  it('shows "?" while RD is over 110, else the rounded rating', () => {
    expect(ratingText({ rating: 1612.4, rd: 110.5, volatility: 0.06 })).toBe("?");
    expect(ratingText({ rating: 1612.6, rd: 110, volatility: 0.06 })).toBe("1613");
  });
});

describe("scoreOf", () => {
  it("scores light 1, 0, or ½ for every finished result", () => {
    expect(scoreOf({ status: "checkmate", winner: "light" })).toBe(1);
    expect(scoreOf({ status: "resigned", winner: "dark" })).toBe(0);
    expect(scoreOf({ status: "time", winner: "dark" })).toBe(0);
    expect(scoreOf({ status: "abandoned", winner: "light" })).toBe(1);
    expect(scoreOf({ status: "draw", reason: "agreement" })).toBe(0.5);
    expect(scoreOf({ status: "draw", reason: "abandoned" })).toBe(0.5);
    expect(scoreOf({ status: "noShow" })).toBeUndefined();
  });
});

const ruleset = resolveRuleset(catalog, "standard");
const first = catalog.setups[0]!.pieces;
const second = mirrorSetup(ruleset.board, "light", first);
const lock = (setup: Lock["setup"], timeControl?: string): Lock => ({
  protocol: PROTOCOL,
  ruleset: { id: ruleset.id, version: ruleset.version },
  setup,
  ...(timeControl && { timeControl }),
});
function room(accounts: [string?, string?], timeControl = "10+0"): RoomData {
  const r = joinRoom(
    createRoom("ABC234", ruleset, lock(first, timeControl), "t0"),
    ruleset,
    lock(second),
    "t1",
    () => 0.9,
    0,
  );
  return {
    ...r,
    seats: r.seats.map((s, i) => ({ ...s, ...(accounts[i] && { account: accounts[i] }) })),
  };
}
const resign = (r: RoomData, seat: Seat) =>
  act(r, ruleset, seat, { type: "resign" } satisfies ClientMessage, 1000);

describe("isRated and ratedGame (D17 default, provisional)", () => {
  it("rates a quick-match game between two signed-in players when it ends", () => {
    const before = room(["acct-a", "acct-b"]);
    expect(isRated(before)).toBe(true);
    const after = resign(before, 0);
    const lightSeat = sideOf(after, 0) === "light" ? 0 : 1;
    expect(ratedGame(before, after)).toEqual({
      ruleset: ruleset.id,
      light: lightSeat === 0 ? "acct-a" : "acct-b",
      dark: lightSeat === 0 ? "acct-b" : "acct-a",
      score: lightSeat === 0 ? 0 : 1,
    });
  });

  it("scores each game once: not while playing, not again after the end", () => {
    const before = room(["acct-a", "acct-b"]);
    const after = resign(before, 0);
    expect(ratedGame(room(["acct-a", "acct-b"]), before)).toBeUndefined();
    expect(ratedGame(after, after)).toBeUndefined();
  });

  it("does not rate when a player is anonymous or both seats are the same account", () => {
    for (const accounts of [["acct-a"], [undefined, "acct-b"], [], ["acct-a", "acct-a"]] as [
      string?,
      string?,
    ][]) {
      const before = room(accounts);
      expect(isRated(before)).toBe(false);
      expect(ratedGame(before, resign(before, 0))).toBeUndefined();
    }
  });

  it("does not rate untimed games: rated play needs a clock or an abandonment rule", () => {
    const before = room(["acct-a", "acct-b"], "untimed");
    expect(isRated(before)).toBe(false);
    expect(ratedGame(before, resign(before, 0))).toBeUndefined();
  });

  it("rates every clocked control and the abandonment-only control", () => {
    for (const tc of ["1+0", "move1d", "away5m"])
      expect(isRated(room(["acct-a", "acct-b"], tc))).toBe(true);
  });

  it("does not rate event games", () => {
    const r = room(["acct-a", "acct-b"]);
    expect(isRated({ ...r, event: { id: "E", round: 0, board: 0, lockBy: 0 } })).toBe(false);
  });
});

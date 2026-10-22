import { describe, expect, it } from "vitest";
import { catalog, resolveRuleset, type Position } from "@apexchess/engine";
import {
  DEFAULT_TIME_CONTROL,
  TIME_CONTROLS,
  clockAfterMove,
  clockDeadline,
  clockLeft,
  startClock,
  timeControl,
  timeoutEnd,
} from "./clock";

const ruleset = resolveRuleset(catalog, "standard");
const tc = (id: string) => timeControl(id)!;

describe("time control data (D19)", () => {
  it("offers every kind, with a timed default and unique ids", () => {
    expect(new Set(TIME_CONTROLS.map((c) => c.kind))).toEqual(
      new Set(["untimed", "fischer", "perMove", "abandonment"]),
    );
    expect(timeControl(DEFAULT_TIME_CONTROL)?.kind).toBe("fischer");
    expect(DEFAULT_TIME_CONTROL).toBe("10+0");
    expect(new Set(TIME_CONTROLS.map((c) => c.id)).size).toBe(TIME_CONTROLS.length);
    expect(timeControl("nope")).toBeUndefined();
  });

  it("keeps the presets proposed in 0007", () => {
    for (const id of ["3+2", "5+3", "10+5", "15+10", "untimed"]) expect(timeControl(id)).toBeTruthy();
  });
});

describe("clocks", () => {
  it("has no clock when untimed or abandonment only", () => {
    expect(startClock(tc("untimed"), "light", 0)).toBeUndefined();
    expect(startClock(tc("away5m"), "light", 0)).toBeUndefined();
  });

  it("Fischer: runs the mover's time down and adds the increment after the move", () => {
    const start = startClock(tc("3+2"), "light", 1000)!;
    expect(start).toEqual({ light: 180_000, dark: 180_000, running: "light", since: 1000 });
    expect(clockDeadline(start)).toBe(181_000);
    expect(clockLeft(start, 11_000)).toEqual({ light: 170_000, dark: 180_000 });
    const after = clockAfterMove(tc("3+2"), start, 11_000);
    expect(after).toEqual({ light: 172_000, dark: 180_000, running: "dark", since: 11_000 });
    expect(clockLeft(after, 999_999)).toEqual({ light: 172_000, dark: 0 });
  });

  it("Fischer without increment: time used is gone", () => {
    const start = startClock(tc("10+0"), "light", 0)!;
    expect(clockAfterMove(tc("10+0"), start, 5_000).light).toBe(595_000);
  });

  it("per move: every move gets the full time, unused time is not kept", () => {
    const start = startClock(tc("move30s"), "light", 0)!;
    expect(clockDeadline(start)).toBe(30_000);
    const after = clockAfterMove(tc("move30s"), start, 10_000);
    expect(after).toEqual({ light: 30_000, dark: 30_000, running: "dark", since: 10_000 });
    expect(clockDeadline(after)).toBe(40_000);
  });

  it("each per-move and Fischer preset starts at its own time", () => {
    for (const c of TIME_CONTROLS) {
      const clock = startClock(c, "dark", 0);
      if (c.kind === "fischer") expect(clock?.dark).toBe(c.initialSeconds * 1000);
      else if (c.kind === "perMove") expect(clock?.dark).toBe(c.seconds * 1000);
      else expect(clock).toBeUndefined();
    }
  });
});

describe("running out of time (D19 with D8)", () => {
  const pos = (squares: Position["squares"]): Position =>
    ({ squares, turn: "light" }) as unknown as Position;
  const kings = { h1: { piece: "king", side: "light" }, a8: { piece: "king", side: "dark" } };

  it("loses when the opponent has mating material", () => {
    const p = pos({ ...kings, b8: { piece: "rook", side: "dark" } } as Position["squares"]);
    expect(timeoutEnd(ruleset, p, "light", "time")).toEqual({ status: "time", winner: "dark" });
    expect(timeoutEnd(ruleset, p, "light", "abandoned")).toEqual({
      status: "abandoned",
      winner: "dark",
    });
  });

  it("draws when the opponent could not checkmate, whatever the loser has", () => {
    const loneKing = pos({ ...kings, g1: { piece: "queen", side: "light" } } as Position["squares"]);
    expect(timeoutEnd(ruleset, loneKing, "light", "time")).toEqual({
      status: "draw",
      reason: "time",
    });
    const knight = pos({
      ...kings,
      b8: { piece: "knight", side: "dark" },
      g1: { piece: "rook", side: "light" },
    } as Position["squares"]);
    expect(timeoutEnd(ruleset, knight, "light", "abandoned")).toEqual({
      status: "draw",
      reason: "abandoned",
    });
  });
});

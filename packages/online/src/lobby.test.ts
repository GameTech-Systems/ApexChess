import { describe, expect, it } from "vitest";
import { leave, seek, type Seeker } from "./lobby";

const seeker = (ticket: string, ruleset = "standard@0.1.0", timeControl = "10+0"): Seeker => ({
  ticket,
  ruleset,
  timeControl,
});

describe("quick match", () => {
  it("waits alone, then pairs the next player on the same ruleset", () => {
    const one = seek([], seeker("a"));
    expect(one.pair).toBeUndefined();
    const two = seek(one.queue, seeker("b"));
    expect(two.pair!.map((s) => s.ticket)).toEqual(["a", "b"]);
    expect(two.queue).toEqual([]);
  });

  it("never pairs players on different ruleset versions", () => {
    const { queue } = seek([], seeker("a", "standard@0.1.0"));
    const next = seek(queue, seeker("b", "standard@1.0.0"));
    expect(next.pair).toBeUndefined();
    expect(next.queue).toHaveLength(2);
    expect(seek(next.queue, seeker("c", "standard@1.0.0")).pair!.map((s) => s.ticket)).toEqual([
      "b",
      "c",
    ]);
  });

  it("pairs only within the same time control (D19)", () => {
    const { queue } = seek([], seeker("a", "standard@0.1.0", "3+2"));
    expect(seek(queue, seeker("b", "standard@0.1.0", "5+3")).pair).toBeUndefined();
    expect(seek(queue, seeker("c", "standard@0.1.0", "3+2")).pair!.map((s) => s.ticket)).toEqual([
      "a",
      "c",
    ]);
  });

  it("pairs the longest-waiting player first and drops one who leaves", () => {
    let queue = seek(seek([], seeker("a")).queue, seeker("x", "other@1")).queue;
    queue = [...queue, seeker("b")];
    expect(seek(queue, seeker("c")).pair!.map((s) => s.ticket)).toEqual(["a", "c"]);
    expect(seek(leave(queue, "a"), seeker("c")).pair!.map((s) => s.ticket)).toEqual(["b", "c"]);
  });

  it("does not pair a player with themselves", () => {
    const { queue } = seek([], seeker("a"));
    const again = seek(queue, seeker("a"));
    expect(again.pair).toBeUndefined();
    expect(again.queue).toHaveLength(1);
  });
});

import { describe, expect, it } from "vitest";
import { seatOf, setupsForGame } from "./seats";

describe("seats (D15)", () => {
  it("alternates sides each game", () => {
    expect([0, 1, 2, 3].map((g) => seatOf(0, g))).toEqual(["light", "dark", "light", "dark"]);
    expect([0, 1].map((g) => seatOf(1, g))).toEqual(["dark", "light"]);
  });
  it("gives each player's own setup to their seat", () => {
    const a = { h1: "king" };
    const b = { h1: "king", g1: "rook" };
    expect(setupsForGame([a, b], 0)).toEqual({ light: a, dark: b });
    expect(setupsForGame([a, b], 1)).toEqual({ light: b, dark: a });
  });
});

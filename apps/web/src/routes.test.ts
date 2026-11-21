import { describe, expect, it } from "vitest";
import { ROUTE_PATHS, routeOf, type Route } from "./routes";

describe("routes", () => {
  it("round-trips every page address", () => {
    for (const r of Object.keys(ROUTE_PATHS) as Route[]) {
      expect(routeOf(ROUTE_PATHS[r])).toBe(r);
      expect(routeOf(ROUTE_PATHS[r].slice(0, -1))).toBe(r);
    }
  });
  it("sends retired pages to the rules and leaves home and unknown paths alone", () => {
    for (const p of ["/how-to-play/", "/45-degree-chess/", "/custom-setups/"])
      expect(routeOf(p)).toBe("rules");
    expect(routeOf("/")).toBeUndefined();
    expect(routeOf("/nope/")).toBeUndefined();
  });
});

import { describe, expect, it } from "vitest";
import { deleteSetup, loadSetups, saveSetup, type KeyValueStore } from "./savedSetups";

function memory(): KeyValueStore {
  const m = new Map<string, string>();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v) };
}

describe("saved setups", () => {
  it("starts empty and survives bad data", () => {
    expect(loadSetups(memory())).toEqual([]);
    const s = memory();
    s.setItem("apexchess.setups.v1", "{oops");
    expect(loadSetups(s)).toEqual([]);
  });
  it("saves, overwrites by name, and deletes", () => {
    const s = memory();
    saveSetup(s, "Mine", { h1: "king" });
    saveSetup(s, "Other", { h1: "king", g1: "rook" });
    saveSetup(s, "Mine", { h1: "king", g1: "bishop" });
    expect(loadSetups(s)).toEqual([
      { name: "Other", pieces: { h1: "king", g1: "rook" } },
      { name: "Mine", pieces: { h1: "king", g1: "bishop" } },
    ]);
    deleteSetup(s, "Other");
    expect(loadSetups(s).map((x) => x.name)).toEqual(["Mine"]);
  });
  it("ignores a blank name and tolerates a store that throws", () => {
    const s = memory();
    saveSetup(s, "  ", { h1: "king" });
    expect(loadSetups(s)).toEqual([]);
    const bad: KeyValueStore = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };
    expect(loadSetups(bad)).toEqual([]);
    expect(() => saveSetup(bad, "x", {})).not.toThrow();
  });
});

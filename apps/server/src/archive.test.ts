import { describe, expect, it } from "vitest";
import { catalog, resolveRuleset } from "@apexchess/engine";
import { archiveRow } from "@apexchess/online";
import migration from "../migrations/0001_archive.sql?raw";
import { insertGame } from "./archive";

const ruleset = resolveRuleset(catalog, "standard");
const row = archiveRow({
  format: 1,
  ruleset: { id: ruleset.id, version: ruleset.version },
  setups: { light: catalog.setups[0]!.pieces, dark: catalog.setups[0]!.pieces },
  moves: [],
  end: { status: "resigned", winner: "light" },
  endDay: "2026-10-22",
});

describe("game archive table", () => {
  it("has a column for every field of a row, and no identity columns", () => {
    const columns = [...migration.matchAll(/^\s+(\w+) (?:TEXT|INTEGER)/gm)].map((m) => m[1]);
    expect(columns).toEqual(["id", ...Object.keys(row)]);
    for (const banned of ["token", "room", "ip", "seat", "time"])
      expect(columns.some((c) => c!.includes(banned))).toBe(false);
  });

  it("inserts a row under a random id, binding values in column order", () => {
    const { sql, values } = insertGame(row, "id-1");
    expect(sql).toBe(
      `INSERT INTO games (id, ${Object.keys(row).join(", ")}) VALUES (${Array(12).fill("?").join(", ")})`,
    );
    expect(values).toEqual(["id-1", ...Object.values(row)]);
  });
});

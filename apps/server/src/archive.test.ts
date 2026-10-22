import { describe, expect, it } from "vitest";
import { catalog, resolveRuleset } from "@apexchess/engine";
import { archiveRow } from "@apexchess/online";
import archive from "../migrations/0001_archive.sql?raw";
import timeControl from "../migrations/0003_time_control.sql?raw";
import { insertGame } from "./archive";

const ruleset = resolveRuleset(catalog, "standard");
const row = archiveRow({
  format: 2,
  ruleset: { id: ruleset.id, version: ruleset.version },
  setups: { light: catalog.setups[0]!.pieces, dark: catalog.setups[0]!.pieces },
  moves: [],
  end: { status: "resigned", winner: "light" },
  endDay: "2026-10-22",
  timeControl: "10+0",
});
const migration = archive + timeControl;

describe("game archive table", () => {
  it("has a column for every field of a row, and no identity columns", () => {
    const columns = [...migration.matchAll(/^\s+(?:ADD COLUMN )?(\w+) (?:TEXT|INTEGER)/gm)].map(
      (m) => m[1],
    );
    expect(columns).toEqual(["id", ...Object.keys(row)]);
    // The time control's id is kept; no clock reading or time of day is.
    const named = columns.filter((c) => c !== "time_control");
    for (const banned of ["token", "room", "ip", "seat", "time", "clock"])
      expect(named.some((c) => c!.includes(banned))).toBe(false);
  });

  it("inserts a row under a random id, binding values in column order", () => {
    const { sql, values } = insertGame(row, "id-1");
    expect(sql).toBe(
      `INSERT INTO games (id, ${Object.keys(row).join(", ")}) VALUES (${Array(13).fill("?").join(", ")})`,
    );
    expect(values).toEqual(["id-1", ...Object.values(row)]);
  });
});

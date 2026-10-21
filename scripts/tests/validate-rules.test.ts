import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
// @ts-expect-error untyped .mjs module
import { validateRules } from "../validate-rules.mjs";

function fixture(files: Record<string, unknown>): string {
  const root = mkdtempSync(join(tmpdir(), "rules-"));
  for (const [rel, data] of Object.entries(files)) {
    const p = join(root, rel);
    mkdirSync(join(p, ".."), { recursive: true });
    writeFileSync(p, JSON.stringify(data));
  }
  return root;
}

describe("validateRules", () => {
  it("passes when rules/ is empty", () => {
    expect(validateRules(fixture({}))).toEqual([]);
  });

  it("validates files in rules/<kind>/ against rules/schema/<kind>.schema.json", () => {
    const schema = { type: "object", required: ["id"], properties: { id: { type: "string" } } };
    const good = fixture({ "schema/piece.schema.json": schema, "piece/a.json": { id: "a" } });
    const bad = fixture({ "schema/piece.schema.json": schema, "piece/a.json": { id: 1 } });
    expect(validateRules(good)).toEqual([]);
    expect(validateRules(bad)).toHaveLength(1);
  });

  it("reports a data folder that has no schema", () => {
    expect(validateRules(fixture({ "piece/a.json": {} }))).toHaveLength(1);
  });
});

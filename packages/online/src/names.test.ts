import { describe, expect, it } from "vitest";
import { NAME_MAX, NAME_MIN, checkName, nameKey } from "./names";

const ok = (text: string) => {
  const r = checkName(text);
  return "name" in r ? r.name : undefined;
};

describe("event display names", () => {
  it("accepts letters, digits, spaces, and - _ . ' and tidies spaces", () => {
    expect(ok("Rook Lover")).toBe("Rook Lover");
    expect(ok("  élan   vital ")).toBe("élan vital");
    expect(ok("o'brien_2.0-x")).toBe("o'brien_2.0-x");
    expect(ok("棋手")).toBe("棋手");
  });

  it(`needs ${NAME_MIN} to ${NAME_MAX} characters`, () => {
    expect(ok("a")).toBeUndefined();
    expect(ok("ab")).toBe("ab");
    expect(ok("x".repeat(NAME_MAX))).toBe("x".repeat(NAME_MAX));
    expect(ok("x".repeat(NAME_MAX + 1))).toBeUndefined();
    expect(ok("")).toBeUndefined();
  });

  it("refuses other characters and names that do not start with a letter or digit", () => {
    for (const bad of ["a@b", "<script>", "hi!", "a\nb", "_lead", "-x", "😀😀", "a​b"])
      expect(ok(bad)).toBeUndefined();
  });

  it("refuses reserved names in any case or spacing", () => {
    for (const bad of ["Apex Chess", "apexchess", "ADMIN", "Moderator", "bye", "Sys-tem"])
      expect(ok(bad)).toBeUndefined();
    expect(checkName("admin")).toEqual({ error: expect.stringMatching(/reserved/) });
  });

  it("compares names without case, spaces, or punctuation", () => {
    expect(nameKey("Rook Lover")).toBe(nameKey("rook-lover"));
    expect(nameKey("Rook Lover")).not.toBe(nameKey("Rook Lovers"));
  });
});

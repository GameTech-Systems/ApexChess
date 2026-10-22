import { describe, expect, it } from "vitest";
import { HANDLE_MAX, HANDLE_MIN, checkHandle, checkName, handleKey, nameKey } from "./names";

const ok = (text: string) => {
  const r = checkHandle(text);
  return "handle" in r ? r.handle : undefined;
};

describe("handles (S19c policy, also used for event names)", () => {
  it("accepts letters, digits, _ and -, starting with a letter, and trims the ends", () => {
    expect(ok("RookLover")).toBe("RookLover");
    expect(ok("  rook_lover-2 ")).toBe("rook_lover-2");
    expect(ok("Abc")).toBe("Abc");
  });

  it(`needs ${HANDLE_MIN} to ${HANDLE_MAX} characters`, () => {
    expect(ok("ab")).toBeUndefined();
    expect(ok("abc")).toBe("abc");
    expect(ok("x".repeat(HANDLE_MAX))).toBe("x".repeat(HANDLE_MAX));
    expect(ok("x".repeat(HANDLE_MAX + 1))).toBeUndefined();
    expect(ok("")).toBeUndefined();
  });

  it("refuses spaces, other characters, look-alike letters, and a leading digit or mark", () => {
    for (const bad of ["Rook Lover", "a@bc", "<script>", "hi!", "a\nbc", "_lead", "-xy", "2nd"])
      expect(ok(bad)).toBeUndefined();
    // Cyrillic "а" looks like Latin "a"; non-ASCII letters could pass for another handle.
    for (const bad of ["аdmin1", "élan", "棋手棋手", "😀😀😀", "a​bc"])
      expect(ok(bad)).toBeUndefined();
  });

  it("refuses reserved names in any case or punctuation, and names that use the site or staff", () => {
    for (const bad of ["ADMIN", "Moderator", "bye", "Sys-tem", "guest", "deleted"])
      expect(ok(bad)).toBeUndefined();
    for (const bad of ["ApexChessTeam", "the_admin", "Admin2", "mod_erator"])
      expect(ok(bad)).toBeUndefined();
    expect(checkHandle("admin")).toEqual({ error: expect.stringMatching(/reserved/) });
  });

  it("compares handles without case, _ or -", () => {
    expect(handleKey("Rook_Lover")).toBe(handleKey("rook-lover"));
    expect(handleKey("RookLover")).toBe("rooklover");
    expect(handleKey("RookLover")).not.toBe(handleKey("RookLovers"));
  });

  it("event names follow the same policy and comparison", () => {
    expect(checkName("Host_One")).toEqual({ name: "Host_One" });
    expect(checkName("Host One")).toEqual({ error: expect.any(String) });
    expect(nameKey("Host_One")).toBe(handleKey("hostone"));
  });
});

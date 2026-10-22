import { describe, expect, it } from "vitest";
import {
  MIN_AGE,
  RECOVERY_CODES,
  RECOVERY_LENGTH,
  formatRecoveryCode,
  normalizeRecoveryCode,
  parseRecoverRequest,
  parseRegisterRequest,
  parseReport,
  recoveryCodes,
  REPORT_REASONS,
} from "./accounts";

/** Repeatable stand-in for random bytes (a small LCG). */
function bytes(n: number, seed = 1): Uint8Array {
  let x = seed;
  return Uint8Array.from({ length: n }, () => (x = (x * 1103515245 + 12345) % 2 ** 31) >> 16);
}

describe("recovery codes", () => {
  it(`makes ${RECOVERY_CODES} codes of ${RECOVERY_LENGTH} characters from random bytes`, () => {
    const codes = recoveryCodes(bytes(RECOVERY_CODES * RECOVERY_LENGTH));
    expect(codes).toHaveLength(RECOVERY_CODES);
    for (const c of codes) expect(c).toMatch(/^[0-9A-HJKMNP-TV-Z]{16}$/);
    expect(new Set(codes).size).toBe(RECOVERY_CODES);
  });

  it("needs enough random bytes", () => {
    expect(() => recoveryCodes(bytes(10))).toThrow();
  });

  it("shows a code in groups of four and reads it back however it was typed", () => {
    const [code] = recoveryCodes(bytes(RECOVERY_CODES * RECOVERY_LENGTH, 7));
    const shown = formatRecoveryCode(code!);
    expect(shown).toMatch(/^(\w{4}-){3}\w{4}$/);
    expect(normalizeRecoveryCode(shown)).toBe(code);
    expect(normalizeRecoveryCode(` ${shown.toLowerCase().replace(/-/g, " ")} `)).toBe(code);
  });

  it("reads O as 0 and I or L as 1, and refuses other text", () => {
    expect(normalizeRecoveryCode("OOOO-IIII-LLLL-2222")).toBe("0000111111112222");
    expect(normalizeRecoveryCode("UUUU-0000-0000-0000")).toBeUndefined();
    expect(normalizeRecoveryCode("0000-0000-0000")).toBeUndefined();
    expect(normalizeRecoveryCode("0000-0000-0000-0000-0")).toBeUndefined();
  });
});

describe("account requests", () => {
  const reg = { handle: "RookLover", ageConfirmed: true, termsAccepted: true };

  it(`signs up only with a valid handle, age ${MIN_AGE} or older confirmed, and the Terms accepted`, () => {
    expect(parseRegisterRequest(reg)).toEqual(reg);
    expect(parseRegisterRequest({ ...reg, handle: " RookLover " })).toEqual(reg);
    expect(parseRegisterRequest({ ...reg, ageConfirmed: false })).toBeUndefined();
    expect(parseRegisterRequest({ ...reg, termsAccepted: false })).toBeUndefined();
    expect(parseRegisterRequest({ handle: "RookLover" })).toBeUndefined();
    expect(parseRegisterRequest({ ...reg, handle: 5 })).toBeUndefined();
    expect(parseRegisterRequest(null)).toBeUndefined();
  });

  it("keeps only the fields it needs", () => {
    expect(parseRegisterRequest({ ...reg, email: "x" })).toEqual(reg);
  });

  it("reads a recovery request: a handle and one code", () => {
    expect(parseRecoverRequest({ handle: "RookLover", code: "OOOO-IIII-LLLL-2222" })).toEqual({
      handle: "RookLover",
      code: "0000111111112222",
    });
    expect(parseRecoverRequest({ handle: "RookLover", code: "nope" })).toBeUndefined();
    expect(parseRecoverRequest({ handle: 1, code: "0000111111112222" })).toBeUndefined();
  });

  it("reads a handle report with a listed reason only", () => {
    expect(REPORT_REASONS.length).toBeGreaterThan(0);
    for (const reason of REPORT_REASONS)
      expect(parseReport({ handle: "RookLover", reason })).toEqual({ handle: "RookLover", reason });
    expect(parseReport({ handle: "RookLover", reason: "other text" })).toBeUndefined();
    expect(parseReport({ handle: "x y", reason: REPORT_REASONS[0] })).toBeUndefined();
  });
});

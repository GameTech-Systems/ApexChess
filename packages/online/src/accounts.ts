/**
 * Accounts (S19c, D16): a passkey plus a handle, no email or password. Pure helpers shared by the
 * server and the web app: recovery codes and the shapes of account requests. WebAuthn itself is
 * checked on the server by @simplewebauthn/server.
 */
import { checkHandle } from "./names";

/** The Terms' minimum age (owner decision, 2026-10-22). Sign-up asks for a yes, not a birth date. */
export const MIN_AGE = 13;

export const RECOVERY_CODES = 8;
/** 16 characters of 5 bits each: 80 bits, so a stored SHA-256 of a code cannot be searched. */
export const RECOVERY_LENGTH = 16;
/** Crockford's base32: no I, L, O, or U. 32 symbols, so a byte maps to one without bias. */
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/** Fresh recovery codes, one character per random byte (the low 5 bits). */
export function recoveryCodes(bytes: Uint8Array): string[] {
  if (bytes.length < RECOVERY_CODES * RECOVERY_LENGTH)
    throw new Error("Not enough random bytes for recovery codes.");
  return Array.from({ length: RECOVERY_CODES }, (_, i) =>
    Array.from(
      bytes.subarray(i * RECOVERY_LENGTH, (i + 1) * RECOVERY_LENGTH),
      (b) => ALPHABET[b & 31],
    ).join(""),
  );
}

/** A code as shown: four groups of four. */
export const formatRecoveryCode = (code: string) => code.match(/.{1,4}/g)!.join("-");

/** A code as typed, in its stored form; O reads as 0 and I or L as 1. */
export function normalizeRecoveryCode(text: string): string | undefined {
  const code = text
    .toUpperCase()
    .replace(/[\s-]/g, "")
    .replace(/O/g, "0")
    .replace(/[IL]/g, "1");
  return code.length === RECOVERY_LENGTH && [...code].every((c) => ALPHABET.includes(c))
    ? code
    : undefined;
}

export interface RegisterRequest {
  handle: string;
  /** The player says they are at least MIN_AGE. */
  ageConfirmed: true;
  termsAccepted: true;
}

export interface RecoverRequest {
  handle: string;
  code: string;
}

/** Why a handle is reported (provisional list). */
export const REPORT_REASONS = ["offensive", "impersonation", "personal-info"] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export interface Report {
  handle: string;
  reason: ReportReason;
}

const record = (value: unknown): Record<string, unknown> | undefined =>
  typeof value === "object" && value !== null ? (value as Record<string, unknown>) : undefined;

const handleOf = (value: unknown) => {
  if (typeof value !== "string") return undefined;
  const r = checkHandle(value);
  return "handle" in r ? r.handle : undefined;
};

export function parseRegisterRequest(value: unknown): RegisterRequest | undefined {
  const v = record(value);
  const handle = handleOf(v?.handle);
  if (!handle || v!.ageConfirmed !== true || v!.termsAccepted !== true) return undefined;
  return { handle, ageConfirmed: true, termsAccepted: true };
}

export function parseRecoverRequest(value: unknown): RecoverRequest | undefined {
  const v = record(value);
  if (typeof v?.handle !== "string" || typeof v.code !== "string") return undefined;
  const code = normalizeRecoveryCode(v.code);
  const handle = v.handle.trim();
  return code && handle ? { handle, code } : undefined;
}

/** Reported handles are checked for shape only; a reserved word cannot belong to anyone. */
export function parseReport(value: unknown): Report | undefined {
  const v = record(value);
  const handle = typeof v?.handle === "string" ? v.handle.trim() : "";
  if (!/^[A-Za-z][A-Za-z0-9_-]{2,19}$/.test(handle)) return undefined;
  const reason = REPORT_REASONS.find((r) => r === v!.reason);
  return reason ? { handle, reason } : undefined;
}

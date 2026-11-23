/**
 * Endpoint limits (S30, I20). Every /api request counts against the general limit (LIMITER); sign-up,
 * passkey, recovery, and room-creation requests also count against a tighter limit of their own.
 * Each is a Cloudflare rate-limit binding in wrangler.jsonc; all values are provisional.
 */
import { clientKey, type Route } from "./routes";

/** The tighter limits, by binding name, with what each guards. */
export const LIMITS = {
  /** Account sign-up (both steps). */
  SIGNUP: "register",
  /** Passkey challenges and answers: sign-in, adding a passkey. */
  PASSKEY: "passkey",
  /** Recovery-code attempts. */
  RECOVER: "recover",
  /** New rooms and events. */
  NEWROOM: "rooms",
} as const;
export type LimitName = keyof typeof LIMITS;

export type Limiters = Record<"LIMITER" | LimitName, RateLimit>;

/** Which tighter limit a route also counts against, if any. */
export function limitFor(r: Route): LimitName | undefined {
  if (r.kind === "create" || r.kind === "newEvent") return "NEWROOM";
  if (r.kind !== "account") return undefined;
  if (r.action === "register" || r.action === "registerFinish") return "SIGNUP";
  if (r.action === "recover") return "RECOVER";
  if (["signIn", "signInFinish", "passkey", "passkeyFinish"].includes(r.action)) return "PASSKEY";
  return undefined;
}

/** True when this request is past the general limit or its endpoint's own, per address. */
export async function overLimit(env: Limiters, r: Route, headers: Headers): Promise<boolean> {
  const key = clientKey(headers);
  if (!(await env.LIMITER.limit({ key })).success) return true;
  const name = limitFor(r);
  return name !== undefined && !(await env[name].limit({ key })).success;
}

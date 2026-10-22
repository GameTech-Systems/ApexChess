/**
 * Accounts (S19c, D16; docs/decisions/0006): a passkey plus a handle, stored in D1 (table layout in
 * migrations/0004_accounts.sql). Passkeys are checked by @simplewebauthn/server. Sessions and
 * recovery codes are stored as SHA-256 hashes only. Game rules never read this; quick match reads
 * the account behind a session, to rate games (S19d). Anonymous play is unchanged.
 */
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type WebAuthnCredential,
  type RegistrationResponseJSON,
} from "@simplewebauthn/server";
import { isoBase64URL } from "@simplewebauthn/server/helpers";
import {
  RoomError,
  formatRecoveryCode,
  handleKey,
  parseRecoverRequest,
  parseRegisterRequest,
  parseReport,
  recoveryCodes,
  RECOVERY_CODES,
  RECOVERY_LENGTH,
} from "@apexchess/online";
import { ratingsOf } from "./ratings";

type Db = Pick<D1Database, "prepare" | "batch">;

export type AccountAction =
  | "register"
  | "registerFinish"
  | "signIn"
  | "signInFinish"
  | "recover"
  | "passkey"
  | "passkeyFinish"
  | "codes"
  | "signOut"
  | "listing"
  | "view"
  | "delete"
  | "report";

export interface AccountDeps {
  db: Db;
  now: number;
  /** The page's origin and passkey RP ID; undefined when the request came from elsewhere. */
  site: { origin: string; rpID: string } | undefined;
  random: (n: number) => Uint8Array<ArrayBuffer>;
  verifyRegistration?: typeof verifyRegistrationResponse;
  verifyAuthentication?: typeof verifyAuthenticationResponse;
}

/** Provisional: a session lasts 30 days; a passkey challenge 5 minutes. */
export const SESSION_MS = 30 * 24 * 60 * 60 * 1000;
export const CHALLENGE_MS = 5 * 60 * 1000;
const RP_NAME = "Apex Chess";

type Purpose =
  | { kind: "register"; accountId: string; handle: string }
  | { kind: "signIn" }
  | { kind: "passkey"; accountId: string };

const day = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const bad = () => new RoomError("bad", "That request was not understood.");
const signInError = (message = "Sign in again.") => new RoomError("signIn", message);
const takenError = () => new RoomError("taken", "That handle is taken. Pick another.");
const newId = (deps: AccountDeps) => isoBase64URL.fromBuffer(deps.random(16));

export async function sha256(text: string): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, "0")).join("");
}

const record = (v: unknown) =>
  typeof v === "object" && v !== null ? (v as Record<string, unknown>) : undefined;

/** A finish step's body: the challenge it answers and the browser's passkey response. */
function finishBody<T>(body: unknown): { challengeId: string; response: T } {
  const v = record(body);
  if (typeof v?.challengeId !== "string" || !record(v.response)) throw bad();
  return { challengeId: v.challengeId, response: v.response as T };
}

function siteOf(deps: AccountDeps) {
  if (!deps.site) throw new RoomError("bad", "Passkeys work only on this site's own pages.");
  return deps.site;
}

async function saveChallenge(deps: AccountDeps, challenge: string, purpose: Purpose) {
  const id = newId(deps);
  await deps.db
    .prepare("INSERT INTO challenges (id, challenge, purpose, expires) VALUES (?, ?, ?, ?)")
    .bind(id, challenge, JSON.stringify(purpose), deps.now + CHALLENGE_MS)
    .run();
  return id;
}

/** A challenge is used once: it is deleted as it is read. */
async function takeChallenge(deps: AccountDeps, id: string, kind: Purpose["kind"]) {
  const row = await deps.db
    .prepare("DELETE FROM challenges WHERE id = ? RETURNING challenge, purpose, expires")
    .bind(id)
    .first<{ challenge: string; purpose: string; expires: number }>();
  const purpose = row && (JSON.parse(row.purpose) as Purpose);
  if (!row || row.expires < deps.now || purpose!.kind !== kind)
    throw new RoomError("stale", "That passkey request ran out of time. Try again.");
  return { challenge: row.challenge, purpose: purpose! };
}

async function handleTaken(db: Db, handle: string) {
  return (
    (await db
      .prepare("SELECT 1 FROM accounts WHERE handle_key = ?")
      .bind(handleKey(handle))
      .first()) !== null
  );
}

/** The account behind a live session token, or undefined (quick match uses it to rate games, S19d). */
export async function sessionAccount(
  db: Db,
  token: string,
  now: number,
): Promise<string | undefined> {
  const row = await db
    .prepare(
      "SELECT s.account_id FROM sessions s JOIN accounts a ON a.id = s.account_id" +
        " WHERE s.token_hash = ? AND s.expires > ?",
    )
    .bind(await sha256(token), now)
    .first<{ account_id: string }>();
  return row?.account_id;
}

async function signedIn(deps: AccountDeps, token: string | undefined) {
  if (!token) throw signInError("Sign in first.");
  const row = await deps.db
    .prepare(
      "SELECT a.id, a.handle, a.created_day, a.listed FROM sessions s JOIN accounts a ON a.id = s.account_id" +
        " WHERE s.token_hash = ? AND s.expires > ?",
    )
    .bind(await sha256(token), deps.now)
    .first<{ id: string; handle: string; created_day: string; listed: number }>();
  if (!row) throw signInError();
  return row;
}

/** A new session: the token goes to the browser, its hash to the table. */
async function newSession(deps: AccountDeps, accountId: string) {
  const token = isoBase64URL.fromBuffer(deps.random(32));
  const stmt = deps.db
    .prepare("INSERT INTO sessions (token_hash, account_id, expires) VALUES (?, ?, ?)")
    .bind(await sha256(token), accountId, deps.now + SESSION_MS);
  return { token, stmt };
}

/** Fresh recovery codes: shown once, stored as hashes, replacing any older ones. */
async function newCodes(deps: AccountDeps, accountId: string) {
  const codes = recoveryCodes(deps.random(RECOVERY_CODES * RECOVERY_LENGTH));
  const insert = deps.db.prepare(
    "INSERT INTO recovery_codes (account_id, code_hash) VALUES (?, ?)",
  );
  const stmts = [
    deps.db.prepare("DELETE FROM recovery_codes WHERE account_id = ?").bind(accountId),
    ...(await Promise.all(codes.map(async (c) => insert.bind(accountId, await sha256(c))))),
  ];
  return { codes: codes.map(formatRecoveryCode), stmts };
}

async function verifyNewPasskey(deps: AccountDeps, body: unknown, purpose: Purpose["kind"]) {
  const site = siteOf(deps);
  const { challengeId, response } = finishBody<RegistrationResponseJSON>(body);
  const taken = await takeChallenge(deps, challengeId, purpose);
  const verify = deps.verifyRegistration ?? verifyRegistrationResponse;
  const result = await verify({
    response,
    expectedChallenge: taken.challenge,
    expectedOrigin: site.origin,
    expectedRPID: site.rpID,
  }).catch(() => undefined);
  if (!result?.verified || !result.registrationInfo)
    throw signInError("That passkey did not work.");
  const { credential } = result.registrationInfo;
  const insert = (accountId: string) =>
    deps.db
      .prepare(
        "INSERT INTO passkeys (credential_id, account_id, public_key, counter, transports, created_day)" +
          " VALUES (?, ?, ?, ?, ?, ?)",
      )
      .bind(
        credential.id,
        accountId,
        isoBase64URL.fromBuffer(credential.publicKey),
        credential.counter,
        JSON.stringify(credential.transports ?? []),
        day(deps.now),
      );
  return { purpose: taken.purpose, insert };
}

/** Run one account action. Throws RoomError for anything the player should see. */
export async function accountAction(
  action: AccountAction,
  body: unknown,
  token: string | undefined,
  deps: AccountDeps,
): Promise<unknown> {
  const { db } = deps;
  switch (action) {
    case "register": {
      const site = siteOf(deps);
      const req = parseRegisterRequest(body);
      if (!req) throw bad();
      if (await handleTaken(db, req.handle)) throw takenError();
      const accountId = newId(deps);
      const options = await generateRegistrationOptions({
        rpName: RP_NAME,
        rpID: site.rpID,
        userName: req.handle,
        userID: isoBase64URL.toBuffer(accountId),
        attestationType: "none",
        authenticatorSelection: { residentKey: "required", userVerification: "preferred" },
      });
      const challengeId = await saveChallenge(deps, options.challenge, {
        kind: "register",
        accountId,
        handle: req.handle,
      });
      return { challengeId, options };
    }
    case "registerFinish": {
      const { purpose, insert } = await verifyNewPasskey(deps, body, "register");
      if (purpose.kind !== "register") throw bad();
      const session = await newSession(deps, purpose.accountId);
      const codes = await newCodes(deps, purpose.accountId);
      try {
        // One transaction: the UNIQUE handle_key refuses a handle taken since the first step.
        await db.batch([
          db
            .prepare(
              "INSERT INTO accounts (id, handle, handle_key, created_day) VALUES (?, ?, ?, ?)",
            )
            .bind(purpose.accountId, purpose.handle, handleKey(purpose.handle), day(deps.now)),
          insert(purpose.accountId),
          ...codes.stmts,
          session.stmt,
        ]);
      } catch {
        if (await handleTaken(db, purpose.handle)) throw takenError();
        throw signInError("That passkey is already in use. Sign in with it instead.");
      }
      return { token: session.token, handle: purpose.handle, codes: codes.codes };
    }
    case "signIn": {
      const site = siteOf(deps);
      const options = await generateAuthenticationOptions({
        rpID: site.rpID,
        userVerification: "preferred",
      });
      return {
        challengeId: await saveChallenge(deps, options.challenge, { kind: "signIn" }),
        options,
      };
    }
    case "signInFinish": {
      const site = siteOf(deps);
      const { challengeId, response } = finishBody<AuthenticationResponseJSON>(body);
      const taken = await takeChallenge(deps, challengeId, "signIn");
      const key = await db
        .prepare(
          "SELECT p.account_id, p.public_key, p.counter, p.transports, a.handle FROM passkeys p" +
            " JOIN accounts a ON a.id = p.account_id WHERE p.credential_id = ?",
        )
        .bind(typeof response.id === "string" ? response.id : "")
        .first<{
          account_id: string;
          public_key: string;
          counter: number;
          transports: string;
          handle: string;
        }>();
      if (!key) throw signInError("That passkey is not known here.");
      const verify = deps.verifyAuthentication ?? verifyAuthenticationResponse;
      const result = await verify({
        response,
        expectedChallenge: taken.challenge,
        expectedOrigin: site.origin,
        expectedRPID: site.rpID,
        credential: {
          id: response.id,
          publicKey: isoBase64URL.toBuffer(key.public_key),
          counter: key.counter,
          transports: JSON.parse(key.transports) as WebAuthnCredential["transports"],
        },
      }).catch(() => undefined);
      if (!result?.verified) throw signInError("That passkey did not work.");
      const session = await newSession(deps, key.account_id);
      await db.batch([
        db
          .prepare("UPDATE passkeys SET counter = ? WHERE credential_id = ?")
          .bind(result.authenticationInfo.newCounter, response.id),
        session.stmt,
      ]);
      return { token: session.token, handle: key.handle };
    }
    case "recover": {
      const req = parseRecoverRequest(body);
      if (!req) throw bad();
      // The code is deleted as it is used, so it works once.
      const row = await db
        .prepare(
          "DELETE FROM recovery_codes WHERE code_hash = ? AND account_id =" +
            " (SELECT id FROM accounts WHERE handle_key = ?) RETURNING account_id",
        )
        .bind(await sha256(req.code), handleKey(req.handle))
        .first<{ account_id: string }>();
      if (!row) throw signInError("That handle and code do not match.");
      const account = await db
        .prepare("SELECT handle FROM accounts WHERE id = ?")
        .bind(row.account_id)
        .first<{ handle: string }>();
      const session = await newSession(deps, row.account_id);
      await session.stmt.run();
      return { token: session.token, handle: account!.handle };
    }
    case "passkey": {
      const site = siteOf(deps);
      const account = await signedIn(deps, token);
      const { results } = await db
        .prepare("SELECT credential_id FROM passkeys WHERE account_id = ?")
        .bind(account.id)
        .all<{ credential_id: string }>();
      const options = await generateRegistrationOptions({
        rpName: RP_NAME,
        rpID: site.rpID,
        userName: account.handle,
        userID: isoBase64URL.toBuffer(account.id),
        attestationType: "none",
        excludeCredentials: results.map((r) => ({ id: r.credential_id })),
        authenticatorSelection: { residentKey: "required", userVerification: "preferred" },
      });
      const challengeId = await saveChallenge(deps, options.challenge, {
        kind: "passkey",
        accountId: account.id,
      });
      return { challengeId, options };
    }
    case "passkeyFinish": {
      const account = await signedIn(deps, token);
      const { purpose, insert } = await verifyNewPasskey(deps, body, "passkey");
      if (purpose.kind !== "passkey" || purpose.accountId !== account.id) throw bad();
      try {
        await insert(account.id).run();
      } catch {
        throw signInError("That passkey is already in use.");
      }
      return {};
    }
    case "codes": {
      const account = await signedIn(deps, token);
      const codes = await newCodes(deps, account.id);
      await db.batch(codes.stmts);
      return { codes: codes.codes };
    }
    case "signOut": {
      if (token)
        await db
          .prepare("DELETE FROM sessions WHERE token_hash = ?")
          .bind(await sha256(token))
          .run();
      return {};
    }
    case "listing": {
      const account = await signedIn(deps, token);
      const listed = (body as { listed?: unknown } | undefined)?.listed;
      if (typeof listed !== "boolean") throw bad();
      await db
        .prepare("UPDATE accounts SET listed = ? WHERE id = ?")
        .bind(listed ? 1 : 0, account.id)
        .run();
      return { listed };
    }
    case "view": {
      const account = await signedIn(deps, token);
      const count = (table: string) =>
        db
          .prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE account_id = ?`)
          .bind(account.id)
          .first<{ n: number }>()
          .then((r) => r?.n ?? 0);
      return {
        handle: account.handle,
        created: account.created_day,
        passkeys: await count("passkeys"),
        codes: await count("recovery_codes"),
        listed: account.listed === 1,
        ratings: await ratingsOf(db, account.id),
      };
    }
    case "delete": {
      const account = await signedIn(deps, token);
      await db.batch(
        ["passkeys", "recovery_codes", "sessions", "ratings"]
          .map((t) => db.prepare(`DELETE FROM ${t} WHERE account_id = ?`).bind(account.id))
          .concat(db.prepare("DELETE FROM accounts WHERE id = ?").bind(account.id)),
      );
      return {};
    }
    case "report": {
      const report = parseReport(body);
      if (!report) throw bad();
      await db
        .prepare("INSERT INTO handle_reports (id, handle_key, reason, day) VALUES (?, ?, ?, ?)")
        .bind(newId(deps), handleKey(report.handle), report.reason, day(deps.now))
        .run();
      return {};
    }
  }
}

/** Part of the daily job: drop expired sessions and challenges. */
export async function cleanUpAccounts(db: Db, now: number) {
  await db.batch([
    db.prepare("DELETE FROM sessions WHERE expires <= ?").bind(now),
    db.prepare("DELETE FROM challenges WHERE expires < ?").bind(now),
  ]);
}

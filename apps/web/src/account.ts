/**
 * Accounts (S19c, D16): a passkey plus a handle. This device keeps the session token; the browser
 * keeps the passkey. The server API is /api/account (apps/server/src/accounts.ts).
 */
import { startAuthentication, startRegistration } from "@simplewebauthn/browser";
import type { RecoverRequest, RegisterRequest, Report } from "@apexchess/online";
import { callApi } from "./event";
import type { KeyValueStore } from "./savedSetups";

export interface Session {
  token: string;
  handle: string;
}

export interface AccountView {
  handle: string;
  created: string;
  passkeys: number;
  codes: number;
  /** One per ruleset id (S19d); `text` is "?" while the rating is still uncertain. */
  ratings: { ruleset: string; games: number; text: string }[];
}

const KEY = "apexchess.account.v1";

export function loadSession(store: KeyValueStore): Session | undefined {
  try {
    const v = JSON.parse(store.getItem(KEY) || "null") as Partial<Session> | null;
    return typeof v?.token === "string" && typeof v.handle === "string"
      ? { token: v.token, handle: v.handle }
      : undefined;
  } catch {
    return undefined;
  }
}

export function saveSession(store: KeyValueStore, session: Session): void {
  try {
    store.setItem(KEY, JSON.stringify(session));
  } catch {
    // Storage blocked: signed in until this page closes.
  }
}

export function clearSession(store: KeyValueStore): void {
  try {
    store.setItem(KEY, "");
  } catch {
    // Nothing was kept.
  }
}

export interface Passkeys {
  startRegistration: typeof startRegistration;
  startAuthentication: typeof startAuthentication;
}
type FetchFn = (url: string, init?: RequestInit) => Promise<Response>;
type Started = { challengeId: string; options: never };

const browserFetch: FetchFn = (url, init) => fetch(url, init);

/** The passkey step; a cancel or a device without passkeys reads as one message. */
async function withPasskey<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch {
    throw new Error("The passkey step did not finish. Try again, or use another device.");
  }
}

export function accountApi(
  fetchFn: FetchFn = browserFetch,
  passkeys: Passkeys = { startRegistration, startAuthentication },
) {
  const post = <T>(url: string, body?: unknown, token?: string) =>
    callApi<T>(fetchFn, url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body ?? {}),
    });
  const auth = (token: string) => ({ headers: { authorization: `Bearer ${token}` } });

  return {
    async signUp(req: RegisterRequest) {
      const s = await post<Started>("/api/account/register", req);
      const response = await withPasskey(() =>
        passkeys.startRegistration({ optionsJSON: s.options }),
      );
      return post<Session & { codes: string[] }>("/api/account/register/finish", {
        challengeId: s.challengeId,
        response,
      });
    },
    async signIn() {
      const s = await post<Started>("/api/account/signin");
      const response = await withPasskey(() =>
        passkeys.startAuthentication({ optionsJSON: s.options }),
      );
      return post<Session>("/api/account/signin/finish", { challengeId: s.challengeId, response });
    },
    recover: (req: RecoverRequest) => post<Session>("/api/account/recover", req),
    async addPasskey(token: string) {
      const s = await post<Started>("/api/account/passkey", {}, token);
      const response = await withPasskey(() =>
        passkeys.startRegistration({ optionsJSON: s.options }),
      );
      await post("/api/account/passkey/finish", { challengeId: s.challengeId, response }, token);
    },
    view: (token: string) => callApi<AccountView>(fetchFn, "/api/account", auth(token)),
    newCodes: (token: string) => post<{ codes: string[] }>("/api/account/codes", {}, token),
    signOut: (token: string) => post("/api/account/signout", {}, token),
    remove: (token: string) =>
      callApi(fetchFn, "/api/account", { method: "DELETE", ...auth(token) }),
    report: (report: Report) => post("/api/reports", report),
  };
}

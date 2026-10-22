import { describe, expect, it } from "vitest";
import { accountApi, clearSession, loadSession, saveSession, type Passkeys } from "./account";
import type { KeyValueStore } from "./savedSetups";

function memory(): KeyValueStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
}

describe("the session kept on this device", () => {
  it("saves, loads, and clears the token and handle", () => {
    const store = memory();
    expect(loadSession(store)).toBeUndefined();
    saveSession(store, { token: "tok", handle: "RookLover" });
    expect(loadSession(store)).toEqual({ token: "tok", handle: "RookLover" });
    clearSession(store);
    expect(loadSession(store)).toBeUndefined();
  });

  it("reads damaged or blocked storage as signed out", () => {
    const store = memory();
    store.setItem("apexchess.account.v1", "{nope");
    expect(loadSession(store)).toBeUndefined();
    store.setItem("apexchess.account.v1", JSON.stringify({ token: 1 }));
    expect(loadSession(store)).toBeUndefined();
    const blocked: KeyValueStore = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };
    expect(loadSession(blocked)).toBeUndefined();
    expect(() => saveSession(blocked, { token: "t", handle: "h" })).not.toThrow();
  });
});

type Call = { url: string; method: string; auth: string | null; body: unknown };
function server(answers: Record<string, unknown>) {
  const calls: Call[] = [];
  const fetchFn = async (url: string, init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    calls.push({
      url,
      method: init?.method ?? "GET",
      auth: headers.get("authorization"),
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    });
    const answer = answers[url];
    if (answer instanceof Response) return answer;
    return new Response(JSON.stringify(answer ?? {}), { status: 200 });
  };
  return { calls, fetchFn };
}
const passkeys: Passkeys = {
  startRegistration: async ({ optionsJSON }) => ({ made: optionsJSON.challenge }) as never,
  startAuthentication: async ({ optionsJSON }) => ({ used: optionsJSON.challenge }) as never,
};
const options = { challengeId: "c1", options: { challenge: "xyz" } };

describe("account api", () => {
  it("signs up: asks for options, makes a passkey, and finishes with it", async () => {
    const { calls, fetchFn } = server({
      "/api/account/register": options,
      "/api/account/register/finish": { token: "t", handle: "RookLover", codes: ["A"] },
    });
    const api = accountApi(fetchFn, passkeys);
    expect(
      await api.signUp({ handle: "RookLover", ageConfirmed: true, termsAccepted: true }),
    ).toEqual({ token: "t", handle: "RookLover", codes: ["A"] });
    expect(calls.map((c) => [c.method, c.url, c.body])).toEqual([
      [
        "POST",
        "/api/account/register",
        { handle: "RookLover", ageConfirmed: true, termsAccepted: true },
      ],
      ["POST", "/api/account/register/finish", { challengeId: "c1", response: { made: "xyz" } }],
    ]);
  });

  it("signs in with a passkey this device offers", async () => {
    const { calls, fetchFn } = server({
      "/api/account/signin": options,
      "/api/account/signin/finish": { token: "t", handle: "RookLover" },
    });
    expect(await accountApi(fetchFn, passkeys).signIn()).toEqual({
      token: "t",
      handle: "RookLover",
    });
    expect(calls[1]!.body).toEqual({ challengeId: "c1", response: { used: "xyz" } });
  });

  it("sends the session token for signed-in actions", async () => {
    const { calls, fetchFn } = server({
      "/api/account/passkey": options,
      "/api/account": { handle: "RookLover", created: "2026-10-22", passkeys: 1, codes: 8 },
    });
    const api = accountApi(fetchFn, passkeys);
    await api.view("tok");
    await api.addPasskey("tok");
    await api.newCodes("tok");
    await api.signOut("tok");
    await api.remove("tok");
    await api.setListed("tok", true);
    expect(calls.map((c) => [c.method, c.url, c.auth])).toEqual([
      ["GET", "/api/account", "Bearer tok"],
      ["POST", "/api/account/passkey", "Bearer tok"],
      ["POST", "/api/account/passkey/finish", "Bearer tok"],
      ["POST", "/api/account/codes", "Bearer tok"],
      ["POST", "/api/account/signout", "Bearer tok"],
      ["DELETE", "/api/account", "Bearer tok"],
      ["POST", "/api/account/listing", "Bearer tok"],
    ]);
    expect(calls.at(-1)!.body).toEqual({ listed: true });
  });

  it("reads the public leaderboards without a token", async () => {
    const boards = [{ ruleset: "standard", players: [{ handle: "A", rating: 1600, games: 40 }] }];
    const { calls, fetchFn } = server({ "/api/leaderboard": boards });
    expect(await accountApi(fetchFn, passkeys).leaderboards()).toEqual(boards);
    expect(calls).toEqual([
      { url: "/api/leaderboard", method: "GET", auth: null, body: undefined },
    ]);
  });

  it("recovers with a code and reports a handle, without a token", async () => {
    const { calls, fetchFn } = server({});
    const api = accountApi(fetchFn, passkeys);
    await api.recover({ handle: "RookLover", code: "AAAA-BBBB-CCCC-DDDD" });
    await api.report({ handle: "Rude", reason: "offensive" });
    expect(calls.map((c) => [c.url, c.auth, c.body])).toEqual([
      ["/api/account/recover", null, { handle: "RookLover", code: "AAAA-BBBB-CCCC-DDDD" }],
      ["/api/reports", null, { handle: "Rude", reason: "offensive" }],
    ]);
  });

  it("shows the server's message when it refuses", async () => {
    const refusal = new Response(
      JSON.stringify({
        type: "error",
        code: "taken",
        message: "That handle is taken. Pick another.",
      }),
      { status: 409 },
    );
    const { fetchFn } = server({ "/api/account/register": refusal });
    await expect(
      accountApi(fetchFn, passkeys).signUp({
        handle: "x",
        ageConfirmed: true,
        termsAccepted: true,
      }),
    ).rejects.toThrow("That handle is taken. Pick another.");
  });

  it("says so when the browser cancels the passkey", async () => {
    const { fetchFn } = server({ "/api/account/signin": options });
    const cancel: Passkeys = {
      ...passkeys,
      startAuthentication: async () => {
        throw new Error("NotAllowedError");
      },
    };
    await expect(accountApi(fetchFn, cancel).signIn()).rejects.toThrow(/passkey/i);
  });
});

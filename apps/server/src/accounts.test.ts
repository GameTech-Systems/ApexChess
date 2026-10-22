import { createRequire } from "node:module";
import { beforeEach, describe, expect, it } from "vitest";
import { RECOVERY_CODES, RoomError, formatRecoveryCode, type ErrorCode } from "@apexchess/online";
import accountsTable from "../migrations/0004_accounts.sql?raw";
import ratingsTable from "../migrations/0005_ratings.sql?raw";
import listingColumn from "../migrations/0006_leaderboards.sql?raw";
import {
  accountAction,
  cleanUpAccounts,
  sessionAccount,
  sha256,
  type AccountDeps,
} from "./accounts";
import { LEADERBOARD_SIZE, leaderboards, rateGame } from "./ratings";

// node:sqlite stands in for D1: same SQL, same migration.
type Sqlite = {
  exec(sql: string): void;
  prepare(sql: string): {
    all(...v: unknown[]): Record<string, unknown>[];
    run(...v: unknown[]): unknown;
  };
};
const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite") as {
  DatabaseSync: new (path: string) => Sqlite;
};
function d1(db: Sqlite) {
  const prepare = (sql: string) => {
    const bound = (values: unknown[]) => ({
      all: async () => ({ results: db.prepare(sql).all(...values) }),
      first: async () => db.prepare(sql).all(...values)[0] ?? null,
      run: async () => {
        db.prepare(sql).run(...values);
        return { success: true };
      },
      sql,
      values,
    });
    return { ...bound([]), bind: (...values: unknown[]) => bound(values) };
  };
  // D1 runs a batch in one transaction.
  const batch = async (stmts: { sql: string; values: unknown[] }[]) => {
    db.exec("BEGIN");
    try {
      for (const s of stmts) db.prepare(s.sql).run(...s.values);
      db.exec("COMMIT");
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
    return stmts.map(() => ({ success: true }));
  };
  return { prepare, batch } as unknown as D1Database;
}

const DAY = 24 * 60 * 60 * 1000;
const T0 = Date.parse("2026-10-22T12:00:00Z");
let sqlite: Sqlite;
let deps: AccountDeps;
let seed = 0;
let lastChallenge = "";
let nextCredential = "cred-1";

const rows = (table: string) => sqlite.prepare(`SELECT * FROM ${table}`).all();

beforeEach(() => {
  sqlite = new DatabaseSync(":memory:");
  sqlite.exec(accountsTable);
  sqlite.exec(ratingsTable);
  sqlite.exec(listingColumn);
  nextCredential = "cred-1";
  deps = {
    db: d1(sqlite),
    now: T0,
    site: { origin: "https://apexchess.icu", rpID: "apexchess.icu" },
    random: (n) => Uint8Array.from({ length: n }, () => (seed = (seed * 75 + 74) % 65537) & 255),
    // Stand-ins for @simplewebauthn/server: they check the challenge and origin they are given.
    verifyRegistration: async (opts) => {
      expect(opts.expectedOrigin).toBe("https://apexchess.icu");
      expect(opts.expectedRPID).toBe("apexchess.icu");
      return {
        verified: opts.expectedChallenge === lastChallenge,
        registrationInfo: {
          credential: {
            id: nextCredential,
            publicKey: Uint8Array.from([1, 2, 3]),
            counter: 0,
            transports: ["internal"],
          },
        },
      } as never;
    },
    verifyAuthentication: async (opts) => {
      expect(opts.credential.publicKey).toEqual(Uint8Array.from([1, 2, 3]));
      return {
        verified: opts.expectedChallenge === lastChallenge,
        authenticationInfo: { newCounter: opts.credential.counter + 1 },
      } as never;
    },
  };
});

async function code(p: Promise<unknown>): Promise<ErrorCode | undefined> {
  try {
    await p;
  } catch (e) {
    if (e instanceof RoomError) return e.code;
    throw e;
  }
  return undefined;
}

type Options = { challengeId: string; options: { challenge: string; user?: { name: string } } };
const start = async (action: "register" | "signIn" | "passkey", body: unknown, token?: string) => {
  const r = (await accountAction(action, body, token, deps)) as Options;
  lastChallenge = r.options.challenge;
  return r;
};
const response = (id = nextCredential) => ({ id, rawId: id, type: "public-key", response: {} });

async function signUp(handle = "RookLover") {
  const { challengeId } = await start("register", {
    handle,
    ageConfirmed: true,
    termsAccepted: true,
  });
  return (await accountAction(
    "registerFinish",
    { challengeId, response: response() },
    undefined,
    deps,
  )) as { token: string; handle: string; codes: string[] };
}

describe("accounts table", () => {
  it("holds no email, password, name, birth date, or address", () => {
    const columns = [...accountsTable.matchAll(/^\s+(\w+) (?:TEXT|INTEGER)/gm)].map((m) => m[1]!);
    for (const banned of ["email", "password", "name", "birth", "age", "ip", "address"])
      expect(columns.filter((c) => c.includes(banned) && c !== "handle")).toEqual([]);
  });
});

describe("signing up (passkey + handle)", () => {
  it("offers a passkey for the handle, then makes the account, a session, and recovery codes", async () => {
    const { options } = await start("register", {
      handle: "RookLover",
      ageConfirmed: true,
      termsAccepted: true,
    });
    expect(options.user?.name).toBe("RookLover");
    expect(rows("accounts")).toEqual([]);
    const { challengeId } = await start("register", {
      handle: "RookLover",
      ageConfirmed: true,
      termsAccepted: true,
    });
    const done = (await accountAction(
      "registerFinish",
      { challengeId, response: response() },
      undefined,
      deps,
    )) as { token: string; handle: string; codes: string[] };
    expect(done.handle).toBe("RookLover");
    expect(done.codes).toHaveLength(RECOVERY_CODES);
    expect(done.codes[0]).toMatch(/^(\w{4}-){3}\w{4}$/);
    expect(rows("accounts")).toEqual([
      {
        id: expect.any(String),
        handle: "RookLover",
        handle_key: "rooklover",
        created_day: "2026-10-22",
        listed: 0,
      },
    ]);
    expect(rows("passkeys")).toHaveLength(1);
    // Only hashes are stored: of the session token and of each code.
    const stored = JSON.stringify([rows("sessions"), rows("recovery_codes")]);
    expect(stored).not.toContain(done.token);
    for (const c of done.codes) expect(stored).not.toContain(c.replace(/-/g, ""));
    expect(rows("sessions")[0]!.token_hash).toBe(await sha256(done.token));
  });

  it("needs age and Terms, and a free handle in any case or punctuation", async () => {
    await signUp("RookLover");
    const body = { handle: "rook_lover", ageConfirmed: true, termsAccepted: true };
    expect(await code(start("register", body))).toBe("taken");
    expect(await code(start("register", { ...body, handle: "Other", ageConfirmed: false }))).toBe(
      "bad",
    );
    expect(await code(start("register", { ...body, handle: "admin" }))).toBe("bad");
  });

  it("refuses a handle taken between the two steps, and keeps no half account", async () => {
    const { challengeId } = await start("register", {
      handle: "RookLover",
      ageConfirmed: true,
      termsAccepted: true,
    });
    const first = lastChallenge;
    nextCredential = "cred-2";
    await signUp("rook-lover");
    nextCredential = "cred-3";
    lastChallenge = first;
    expect(
      await code(
        accountAction("registerFinish", { challengeId, response: response() }, undefined, deps),
      ),
    ).toBe("taken");
    expect(rows("accounts")).toHaveLength(1);
    expect(rows("passkeys")).toHaveLength(1);
  });

  it("uses each challenge once, and not after it expires", async () => {
    const { challengeId } = await start("register", {
      handle: "RookLover",
      ageConfirmed: true,
      termsAccepted: true,
    });
    deps.now = T0 + 6 * 60 * 1000;
    const finish = () =>
      accountAction("registerFinish", { challengeId, response: response() }, undefined, deps);
    expect(await code(finish())).toBe("stale");
    deps.now = T0;
    expect(await code(finish())).toBe("stale");
  });

  it("refuses a passkey that does not verify", async () => {
    const { challengeId } = await start("register", {
      handle: "RookLover",
      ageConfirmed: true,
      termsAccepted: true,
    });
    lastChallenge = "other";
    expect(
      await code(
        accountAction("registerFinish", { challengeId, response: response() }, undefined, deps),
      ),
    ).toBe("signIn");
    expect(rows("accounts")).toEqual([]);
  });

  it("needs this site's origin for passkey steps", async () => {
    deps.site = undefined;
    expect(
      await code(start("register", { handle: "Abc", ageConfirmed: true, termsAccepted: true })),
    ).toBe("bad");
  });
});

describe("signing in", () => {
  it("signs in with a known passkey and counts its use", async () => {
    await signUp();
    const { challengeId } = await start("signIn", {});
    const r = (await accountAction(
      "signInFinish",
      { challengeId, response: response("cred-1") },
      undefined,
      deps,
    )) as { token: string; handle: string };
    expect(r.handle).toBe("RookLover");
    expect(rows("passkeys")[0]!.counter).toBe(1);
    expect(await accountAction("view", undefined, r.token, deps)).toEqual({
      handle: "RookLover",
      created: "2026-10-22",
      passkeys: 1,
      codes: RECOVERY_CODES,
      listed: false,
      ratings: [],
    });
  });

  it("refuses an unknown passkey, a missing or wrong token, and an expired session", async () => {
    const { token } = await signUp();
    const { challengeId } = await start("signIn", {});
    expect(
      await code(
        accountAction("signInFinish", { challengeId, response: response("nope") }, undefined, deps),
      ),
    ).toBe("signIn");
    expect(await code(accountAction("view", undefined, undefined, deps))).toBe("signIn");
    expect(await code(accountAction("view", undefined, "wrong", deps))).toBe("signIn");
    deps.now = T0 + 31 * DAY;
    expect(await code(accountAction("view", undefined, token, deps))).toBe("signIn");
  });

  it("signs out: the token stops working", async () => {
    const { token } = await signUp();
    await accountAction("signOut", undefined, token, deps);
    expect(await code(accountAction("view", undefined, token, deps))).toBe("signIn");
  });
});

describe("recovery codes", () => {
  it("each code signs in once, for its own handle only", async () => {
    const { codes } = await signUp();
    nextCredential = "cred-9";
    await signUp("Other");
    const recover = (handle: string, c: string) =>
      accountAction("recover", { handle, code: c }, undefined, deps) as Promise<{ token: string }>;
    expect(await code(recover("Other", codes[0]!))).toBe("signIn");
    const { token } = await recover("rook_lover", codes[0]!.toLowerCase());
    expect(await accountAction("view", undefined, token, deps)).toMatchObject({
      handle: "RookLover",
      codes: RECOVERY_CODES - 1,
    });
    expect(await code(recover("RookLover", codes[0]!))).toBe("signIn");
  });

  it("new codes replace the old ones", async () => {
    const { token, codes } = await signUp();
    const fresh = (await accountAction("codes", undefined, token, deps)) as { codes: string[] };
    expect(fresh.codes).toHaveLength(RECOVERY_CODES);
    expect(fresh.codes).not.toContain(codes[0]);
    expect(
      await code(
        accountAction("recover", { handle: "RookLover", code: codes[0] }, undefined, deps),
      ),
    ).toBe("signIn");
    expect(
      await accountAction(
        "recover",
        { handle: "RookLover", code: fresh.codes[0] },
        undefined,
        deps,
      ),
    ).toMatchObject({ handle: "RookLover" });
  });

  it("shows codes in groups of four", async () => {
    const { codes } = await signUp();
    expect(codes.map((c) => formatRecoveryCode(c.replace(/-/g, "")))).toEqual(codes);
  });
});

describe("adding a passkey", () => {
  it("adds a second passkey to a signed-in account, and only then", async () => {
    const { token } = await signUp();
    expect(await code(start("passkey", {}))).toBe("signIn");
    const { challengeId } = await start("passkey", {}, token);
    nextCredential = "cred-2";
    await accountAction("passkeyFinish", { challengeId, response: response() }, token, deps);
    expect(rows("passkeys").map((r) => r.credential_id)).toEqual(["cred-1", "cred-2"]);
    expect(await accountAction("view", undefined, token, deps)).toMatchObject({ passkeys: 2 });
  });
});

describe("deleting an account", () => {
  it("deletes every row that names it, and frees the handle", async () => {
    const { token } = await signUp();
    nextCredential = "cred-2";
    const other = await signUp("Other");
    const id = rows("accounts").find((a) => a.handle === "RookLover")!.id as string;
    const otherId = rows("accounts").find((a) => a.handle === "Other")!.id as string;
    await rateGame(deps.db, { ruleset: "standard", light: id, dark: otherId, score: 1 });
    await accountAction("delete", undefined, token, deps);
    expect(rows("ratings").map((r) => r.account_id)).toEqual([otherId]);
    for (const t of ["accounts", "passkeys", "recovery_codes", "sessions", "ratings"])
      expect(JSON.stringify(rows(t))).not.toMatch(/RookLover|cred-1/);
    expect(rows("accounts")).toHaveLength(1);
    expect(await code(accountAction("view", undefined, token, deps))).toBe("signIn");
    expect(await accountAction("view", undefined, other.token, deps)).toMatchObject({
      handle: "Other",
    });
    nextCredential = "cred-3";
    expect((await signUp("RookLover")).handle).toBe("RookLover");
  });
});

describe("handle reports", () => {
  it("keeps the handle, a listed reason, and the day; nothing about the sender", async () => {
    await accountAction("report", { handle: "Rook_Lover", reason: "offensive" }, undefined, deps);
    expect(rows("handle_reports")).toEqual([
      { id: expect.any(String), handle_key: "rooklover", reason: "offensive", day: "2026-10-22" },
    ]);
    expect(
      await code(accountAction("report", { handle: "x", reason: "offensive" }, undefined, deps)),
    ).toBe("bad");
  });
});

describe("daily clean-up", () => {
  it("deletes expired sessions and challenges only", async () => {
    const { token } = await signUp();
    await start("signIn", {});
    deps.now = T0 + 10 * 60 * 1000;
    await start("signIn", {});
    await cleanUpAccounts(deps.db, deps.now);
    expect(rows("challenges")).toHaveLength(1);
    expect(rows("sessions")).toHaveLength(1);
    await cleanUpAccounts(deps.db, T0 + 31 * DAY);
    expect(rows("sessions")).toEqual([]);
    expect(await code(accountAction("view", undefined, token, deps))).toBe("signIn");
  });
});

describe("ratings (S19d)", () => {
  async function two() {
    const a = await signUp("RookLover");
    nextCredential = "cred-2";
    const b = await signUp("Other");
    const id = (handle: string) => rows("accounts").find((r) => r.handle === handle)!.id as string;
    return { a: { ...a, id: id("RookLover") }, b: { ...b, id: id("Other") } };
  }
  const ratings = (token: string) =>
    accountAction("view", undefined, token, deps).then((v) => (v as { ratings: unknown }).ratings);

  it("finds the account behind a live session only", async () => {
    const { a } = await two();
    expect(await sessionAccount(deps.db, a.token, T0)).toBe(a.id);
    expect(await sessionAccount(deps.db, "wrong", T0)).toBeUndefined();
    expect(await sessionAccount(deps.db, a.token, T0 + 31 * DAY)).toBeUndefined();
  });

  it("starts both players at 1500/350 and updates each from the other's old rating", async () => {
    const { a, b } = await two();
    await rateGame(deps.db, { ruleset: "standard", light: a.id, dark: b.id, score: 1 });
    const [ra] = (await ratings(a.token)) as { rating: number; rd: number; games: number }[];
    const [rb] = (await ratings(b.token)) as { rating: number; rd: number; games: number }[];
    expect(ra).toMatchObject({ ruleset: "standard", games: 1, text: "?" });
    expect(rb).toMatchObject({ ruleset: "standard", games: 1, text: "?" });
    expect(ra!.rating).toBeGreaterThan(1500);
    expect(ra!.rating - 1500).toBeCloseTo(1500 - rb!.rating, 6);
    expect(ra!.rd).toBeLessThan(350);
  });

  it("keeps one pool per ruleset id", async () => {
    const { a, b } = await two();
    await rateGame(deps.db, { ruleset: "standard", light: a.id, dark: b.id, score: 0.5 });
    await rateGame(deps.db, { ruleset: "elbow-room", light: b.id, dark: a.id, score: 0 });
    await rateGame(deps.db, { ruleset: "standard", light: b.id, dark: a.id, score: 1 });
    const list = (await ratings(a.token)) as { ruleset: string; games: number }[];
    expect(list.map((r) => [r.ruleset, r.games])).toEqual([
      ["elbow-room", 1],
      ["standard", 2],
    ]);
  });

  it("shows the rating once RD is 110 or less", async () => {
    const { a, b } = await two();
    for (let i = 0; i < 30; i++)
      await rateGame(deps.db, { ruleset: "standard", light: a.id, dark: b.id, score: i % 2 });
    const [r] = (await ratings(a.token)) as { rd: number; text: string }[];
    expect(r!.rd).toBeLessThanOrEqual(110);
    expect(r!.text).toMatch(/^\d+$/);
  });

  it("scores nothing when either account is gone", async () => {
    const { a, b } = await two();
    await accountAction("delete", undefined, b.token, deps);
    await rateGame(deps.db, { ruleset: "standard", light: a.id, dark: b.id, score: 1 });
    expect(rows("ratings")).toEqual([]);
  });
});

describe("leaderboards (S20d)", () => {
  async function players(handles: string[]) {
    const out: { token: string; id: string }[] = [];
    for (const [i, handle] of handles.entries()) {
      nextCredential = `cred-${i + 1}`;
      const { token } = await signUp(handle);
      out.push({ token, id: rows("accounts").find((r) => r.handle === handle)!.id as string });
    }
    return out;
  }
  /** Enough games that both ratings settle (RD ≤ 110); `better` wins 3 of every 4. */
  async function settle(ruleset: string, better: string, worse: string) {
    for (let i = 0; i < 40; i++)
      await rateGame(deps.db, { ruleset, light: better, dark: worse, score: i % 4 < 3 ? 1 : 0 });
  }
  const listing = (token: string | undefined, body: unknown) =>
    accountAction("listing", body, token, deps);
  const view = (token: string) =>
    accountAction("view", undefined, token, deps) as Promise<{ listed: boolean }>;

  it("is off until the player turns it on, and needs a signed-in player", async () => {
    const [a] = await players(["RookLover"]);
    expect((await view(a!.token)).listed).toBe(false);
    expect(await code(listing(undefined, { listed: true }))).toBe("signIn");
    expect(await code(listing(a!.token, { listed: "yes" }))).toBe("bad");
    expect(await listing(a!.token, { listed: true })).toEqual({ listed: true });
    expect((await view(a!.token)).listed).toBe(true);
    expect(await listing(a!.token, { listed: false })).toEqual({ listed: false });
    expect((await view(a!.token)).listed).toBe(false);
  });

  it("lists only opted-in players with a settled rating, best first, one board per ruleset id", async () => {
    const [a, b, c] = await players(["RookLover", "Other", "Third"]);
    await settle("standard", a!.id, b!.id);
    await settle("elbow-room", c!.id, a!.id);
    await rateGame(deps.db, { ruleset: "unsettled", light: a!.id, dark: c!.id, score: 1 });
    expect(await leaderboards(deps.db)).toEqual([]);
    await listing(a!.token, { listed: true });
    await listing(c!.token, { listed: true });
    const boards = await leaderboards(deps.db);
    expect(boards.map((x) => x.ruleset)).toEqual(["elbow-room", "standard"]);
    const [elbow, standard] = boards;
    expect(elbow!.players.map((p) => p.handle)).toEqual(["Third", "RookLover"]);
    expect(standard!.players.map((p) => p.handle)).toEqual(["RookLover"]);
    // Handle, rounded rating, and rated games only: no account id, RD, or volatility.
    expect(Object.keys(standard!.players[0]!).sort()).toEqual(["games", "handle", "rating"]);
    expect(Number.isInteger(standard!.players[0]!.rating)).toBe(true);
    expect(standard!.players[0]!.games).toBe(40);
  });

  it("drops a player at once when they turn listing off or delete the account", async () => {
    const [a, b] = await players(["RookLover", "Other"]);
    await settle("standard", a!.id, b!.id);
    await listing(a!.token, { listed: true });
    await listing(b!.token, { listed: true });
    expect((await leaderboards(deps.db))[0]!.players).toHaveLength(2);
    await listing(a!.token, { listed: false });
    expect((await leaderboards(deps.db))[0]!.players.map((p) => p.handle)).toEqual(["Other"]);
    await accountAction("delete", undefined, b!.token, deps);
    expect(await leaderboards(deps.db)).toEqual([]);
  });

  it(`shows at most ${LEADERBOARD_SIZE} players per board`, async () => {
    const [a, b] = await players(["RookLover", "Other"]);
    await settle("standard", a!.id, b!.id);
    await listing(a!.token, { listed: true });
    await listing(b!.token, { listed: true });
    expect((await leaderboards(deps.db, 1))[0]!.players.map((p) => p.handle)).toHaveLength(1);
  });
});

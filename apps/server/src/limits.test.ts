import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { LIMITS, limitFor, overLimit, type LimitName } from "./limits";
import { route } from "./routes";

/** A limiter that allows `max` calls per key, like one Cloudflare rate-limit binding. */
function fake(max: number) {
  const seen = new Map<string, number>();
  return {
    limit: async ({ key }: { key: string }) => {
      const n = (seen.get(key) ?? 0) + 1;
      seen.set(key, n);
      return { success: n <= max };
    },
  };
}
const env = (max: Record<"LIMITER" | LimitName, number>) =>
  Object.fromEntries(Object.entries(max).map(([k, v]) => [k, fake(v)])) as never;
const ip = (a: string) => new Headers({ "cf-connecting-ip": a });

describe("limit groups (I20)", () => {
  it("puts sign-up, passkey, recovery, and room creation in their own groups", () => {
    const group = (m: string, p: string) => {
      const r = route(m, p);
      return r && limitFor(r);
    };
    expect(group("POST", "/api/account/register")).toBe("SIGNUP");
    expect(group("POST", "/api/account/register/finish")).toBe("SIGNUP");
    for (const p of ["signin", "signin/finish", "passkey", "passkey/finish"])
      expect(group("POST", `/api/account/${p}`)).toBe("PASSKEY");
    expect(group("POST", "/api/account/recover")).toBe("RECOVER");
    expect(group("POST", "/api/rooms")).toBe("NEWROOM");
    expect(group("POST", "/api/events")).toBe("NEWROOM");
  });

  it("leaves everything else on the general limit only", () => {
    for (const [m, p] of [
      ["GET", "/api/account"],
      ["DELETE", "/api/account"],
      ["POST", "/api/account/codes"],
      ["POST", "/api/account/signout"],
      ["GET", "/api/stats"],
      ["GET", "/api/leaderboard"],
      ["POST", "/api/rooms/ABCDEF/join"],
      ["GET", "/api/rooms/ABCDEF/socket"],
    ] as const)
      expect(limitFor(route(m, p)!), `${m} ${p}`).toBeUndefined();
  });
});

describe("endpoint limits answer 429 past their limit", () => {
  const cases: [string, string, LimitName, number][] = [
    ["POST", "/api/account/register", "SIGNUP", 2],
    ["POST", "/api/account/signin", "PASSKEY", 3],
    ["POST", "/api/account/recover", "RECOVER", 2],
    ["POST", "/api/rooms", "NEWROOM", 2],
  ];
  for (const [method, path, name, max] of cases) {
    it(`${method} ${path}: ${max} allowed, then busy; other addresses unaffected`, async () => {
      const e = env({
        LIMITER: 100,
        SIGNUP: 100,
        PASSKEY: 100,
        RECOVER: 100,
        NEWROOM: 100,
        [name]: max,
      });
      const r = route(method, path)!;
      for (let i = 0; i < max; i++) expect(await overLimit(e, r, ip("1.1.1.1"))).toBe(false);
      expect(await overLimit(e, r, ip("1.1.1.1"))).toBe(true);
      expect(await overLimit(e, r, ip("2.2.2.2"))).toBe(false);
    });
  }

  it("still applies the general limit to a limited endpoint", async () => {
    const e = env({ LIMITER: 1, SIGNUP: 100, PASSKEY: 100, RECOVER: 100, NEWROOM: 100 });
    const r = route("POST", "/api/rooms")!;
    expect(await overLimit(e, r, ip("1.1.1.1"))).toBe(false);
    expect(await overLimit(e, r, ip("1.1.1.1"))).toBe(true);
  });

  it("does not spend a group's allowance on other groups' requests", async () => {
    const e = env({ LIMITER: 100, SIGNUP: 1, PASSKEY: 100, RECOVER: 1, NEWROOM: 1 });
    expect(await overLimit(e, route("POST", "/api/account/recover")!, ip("3.3.3.3"))).toBe(false);
    expect(await overLimit(e, route("POST", "/api/rooms")!, ip("3.3.3.3"))).toBe(false);
    expect(await overLimit(e, route("POST", "/api/account/register")!, ip("3.3.3.3"))).toBe(false);
  });
});

describe("wrangler.jsonc", () => {
  const text = readFileSync(new URL("../../../wrangler.jsonc", import.meta.url), "utf8");
  const config = JSON.parse(text.replace(/^\s*\/\/.*$/gm, "").replace(/,(\s*[}\]])/g, "$1")) as {
    ratelimits: { name: string; namespace_id: string; simple: { limit: number; period: number } }[];
  };
  const by = new Map(config.ratelimits.map((l) => [l.name, l]));

  it("binds the general limit and one tighter limit per group, each in its own namespace", () => {
    expect([...by.keys()].sort()).toEqual(["LIMITER", ...Object.keys(LIMITS)].sort());
    expect(new Set(config.ratelimits.map((l) => l.namespace_id)).size).toBe(by.size);
    for (const name of Object.keys(LIMITS)) {
      const l = by.get(name)!;
      expect([10, 60]).toContain(l.simple.period);
      expect(l.simple.limit).toBeLessThan(by.get("LIMITER")!.simple.limit);
    }
  });
});

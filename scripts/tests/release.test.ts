import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
// @ts-expect-error plain .mjs scripts
import { versionJson, writeVersion } from "../write-version.mjs";
// @ts-expect-error plain .mjs scripts
import { smoke } from "../smoke.mjs";

const root = join(__dirname, "..", "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");
const SHA = "0123456789abcdef0123456789abcdef01234567";

describe("version file", () => {
  it("uses GITHUB_SHA, else the git commit, else unknown", () => {
    expect(versionJson({ GITHUB_SHA: SHA }, "other").commit).toBe(SHA);
    expect(versionJson({}, "abc").commit).toBe("abc");
    expect(versionJson({}, undefined).commit).toBe("unknown");
  });
  it("writes version.json into the folder", () => {
    const dir = mkdtempSync(join(tmpdir(), "ver-"));
    writeVersion(dir, { GITHUB_SHA: SHA });
    expect(JSON.parse(readFileSync(join(dir, "version.json"), "utf8")).commit).toBe(SHA);
  });
});

/** A fake site: every check passes unless `bad` names it. */
function fakes(bad: string[] = [], commit = SHA) {
  const fetchFn = async (url: string, init?: { method?: string }) => {
    const path = new URL(url).pathname;
    const ok = (body: unknown, status = 200) =>
      new Response(typeof body === "string" ? body : JSON.stringify(body), { status });
    if (path === "/")
      return bad.includes("home")
        ? ok("", 500)
        : ok('<title>Apex Chess</title><script src="/assets/index-a1.js"></script>');
    if (path === "/assets/index-a1.js") return ok('new Worker("assets/computer.worker-b2.js")');
    if (path === "/assets/computer.worker-b2.js")
      return bad.includes("worker")
        ? ok("<html>", 200)
        : new Response("self.onmessage=1", { headers: { "content-type": "text/javascript" } });
    if (path === "/how-to-play/")
      return bad.includes("info")
        ? ok("<title>Apex Chess</title>")
        : ok('<link rel="canonical" href="https://apexchess.icu/how-to-play/" />');
    if (path === "/sw.js")
      return bad.includes("sw")
        ? ok("<html>", 200)
        : new Response("const PRECACHE = [];", { headers: { "content-type": "text/javascript" } });
    if (path === "/version.json") return ok({ commit });
    if (path === "/api/stats") return bad.includes("api") ? ok("", 500) : ok([]);
    if (path === "/api/rooms" && init?.method === "POST")
      return bad.includes("create") ? ok({ error: 1 }, 400) : ok({ room: "ABCD", token: "t1" });
    if (path === "/api/rooms/ABCD/join") return ok({ room: "ABCD", token: "t2" });
    return ok("", 404);
  };
  class FakeSocket {
    onmessage: ((e: { data: string }) => void) | null = null;
    onerror: (() => void) | null = null;
    constructor(public url: string) {
      setTimeout(() => {
        if (bad.includes("socket")) this.onerror?.();
        else this.onmessage?.({ data: JSON.stringify({ type: "state", room: "ABCD" }) });
      }, 0);
    }
    close() {}
  }
  return { fetchFn, WebSocketImpl: FakeSocket };
}

describe("smoke test", () => {
  it("passes when home, API, rooms, and socket work and the commit matches", async () => {
    const r = await smoke("https://x.test", { expectCommit: SHA, ...fakes() });
    expect(r.failures).toEqual([]);
  });
  it.each(["home", "info", "worker", "sw", "api", "create", "socket"])(
    "fails when %s is broken",
    async (what) => {
      const r = await smoke("https://x.test", { expectCommit: SHA, ...fakes([what]) });
      expect(r.failures.length).toBeGreaterThan(0);
    },
  );
  it("fails when the live commit is not the deployed one", async () => {
    const r = await smoke("https://x.test", { expectCommit: SHA, ...fakes([], "deadbeef") });
    expect(r.failures.join()).toMatch(/commit/);
  });
});

describe("workflows", () => {
  it("CI runs pnpm build", () => {
    expect(read(".github/workflows/ci.yml")).toMatch(/run: pnpm build/);
  });
  const deploy = read(".github/workflows/deploy.yml");
  it("deploy fails on a missing secret and has no secret-gated skips", () => {
    expect(deploy).toMatch(/CLOUDFLARE_API_TOKEN/);
    expect(deploy).toMatch(/CLOUDFLARE_ACCOUNT_ID/);
    expect(deploy).toMatch(/exit 1/);
    expect(deploy).not.toMatch(/if: env\.CLOUDFLARE_API_TOKEN/);
  });
  it("deploy smoke-tests the live site after deploying", () => {
    expect(deploy.indexOf("wrangler@4 deploy")).toBeGreaterThan(-1);
    expect(deploy.indexOf("scripts/smoke.mjs")).toBeGreaterThan(
      deploy.indexOf("wrangler@4 deploy"),
    );
    expect(deploy).toMatch(/github\.sha/);
  });
  it("the web build writes the version file", () => {
    expect(read("apps/web/package.json")).toMatch(/write-version\.mjs/);
  });
});

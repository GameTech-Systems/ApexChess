import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";
// @ts-expect-error plain .mjs scripts
import { precacheList, writeServiceWorker } from "../write-sw.mjs";

const root = join(__dirname, "..", "..");

function site(files: Record<string, string>) {
  const dir = mkdtempSync(join(tmpdir(), "sw-"));
  for (const [p, body] of Object.entries(files)) {
    mkdirSync(join(dir, p, ".."), { recursive: true });
    writeFileSync(join(dir, p), body);
  }
  return dir;
}
const FILES = {
  "index.html": "<html>1</html>",
  "assets/app-abc.js": "a",
  "assets/app-abc.js.map": "m",
  "how-to-play/index.html": "<html>h</html>",
  "favicon.svg": "<svg/>",
  "version.json": "{}",
  _headers: "x",
  "robots.txt": "r",
  "sitemap.xml": "s",
};

describe("service worker build", () => {
  it("precaches the app, pages, and assets, but not the deploy check or crawler files", () => {
    expect(precacheList(site(FILES))).toEqual([
      "/",
      "/assets/app-abc.js",
      "/favicon.svg",
      "/how-to-play/",
    ]);
  });
  it("names its cache by content, so a new build replaces the old cache", () => {
    const name = (extra: string) => {
      const dir = site({ ...FILES, "index.html": extra });
      writeServiceWorker(dir);
      return /const CACHE = "(apex-[0-9a-f]{12})"/.exec(
        readFileSync(join(dir, "sw.js"), "utf8"),
      )![1];
    };
    expect(name("a")).toBe(name("a"));
    expect(name("a")).not.toBe(name("b"));
  });
});

type Handler = (e: unknown) => void;
/** Runs the generated worker against fake caches and a fake network. */
function run(opts: { online: boolean }) {
  const dir = site(FILES);
  writeServiceWorker(dir);
  const handlers: Record<string, Handler> = {};
  const fire = (type: string, e: unknown) => handlers[type]!(e);
  const stores = new Map<string, Map<string, Response>>();
  const key = (r: Request | string) => new URL(typeof r === "string" ? r : r.url, "https://x.test");
  const cacheOf = (name: string) => {
    if (!stores.has(name)) stores.set(name, new Map());
    const m = stores.get(name)!;
    return {
      addAll: async (urls: string[]) =>
        urls.forEach((u) => m.set(key(u).pathname, new Response(`cached ${u}`))),
      put: async (r: Request, res: Response) => void m.set(key(r).pathname + key(r).search, res),
      match: async (r: Request | string, o?: { ignoreSearch?: boolean }) => {
        const k = key(r);
        return m.get(o?.ignoreSearch ? k.pathname : k.pathname + k.search) ?? m.get(k.pathname);
      },
    };
  };
  const calls: string[] = [];
  runInNewContext(readFileSync(join(dir, "sw.js"), "utf8"), {
    self: {
      location: { origin: "https://x.test" },
      addEventListener: (t: string, h: Handler) => (handlers[t] = h),
    },
    caches: {
      open: async (n: string) => cacheOf(n),
      keys: async () => [...stores.keys()],
      delete: async (n: string) => stores.delete(n),
    },
    fetch: async (r: Request) => {
      calls.push(key(r).pathname);
      if (!opts.online) throw new TypeError("offline");
      return new Response(`network ${key(r).pathname}`);
    },
    URL,
    Promise,
    Response,
  });
  const fetchEvent = (url: string, init: { method?: string; mode?: string } = {}) => {
    const request = {
      url: "https://x.test" + url,
      method: init.method ?? "GET",
      mode: init.mode ?? "no-cors",
    };
    let answer: Promise<Response> | undefined;
    fire("fetch", { request, respondWith: (p: Promise<Response>) => (answer = p) });
    return answer;
  };
  const install = async () => {
    let wait: Promise<unknown> = Promise.resolve();
    fire("install", { waitUntil: (p: Promise<unknown>) => (wait = p) });
    await wait;
  };
  return { fire, stores, calls, fetchEvent, install };
}

describe("service worker behavior", () => {
  it("precaches on install without skipping the wait", async () => {
    const sw = run({ online: true });
    await sw.install();
    expect([...[...sw.stores.values()][0]!.keys()]).toContain("/assets/app-abc.js");
  });
  it("leaves the API, other methods, other origins, and the version check to the network", async () => {
    const sw = run({ online: false });
    expect(sw.fetchEvent("/api/stats")).toBeUndefined();
    expect(sw.fetchEvent("/version.json")).toBeUndefined();
    expect(sw.fetchEvent("/assets/app-abc.js", { method: "POST" })).toBeUndefined();
    let other: unknown;
    sw.fire("fetch", {
      request: { url: "https://other.test/x", method: "GET", mode: "no-cors" },
      respondWith: (p: unknown) => (other = p),
    });
    expect(other).toBeUndefined();
  });
  it("serves assets from the cache, with no network call", async () => {
    const sw = run({ online: false });
    await sw.install();
    expect(await (await sw.fetchEvent("/assets/app-abc.js"))!.text()).toBe(
      "cached /assets/app-abc.js",
    );
    expect(sw.calls).toEqual([]);
  });
  it("opens pages offline from the cache, falling back to the app for unknown paths", async () => {
    const sw = run({ online: false });
    await sw.install();
    expect(await (await sw.fetchEvent("/how-to-play/?x=1", { mode: "navigate" }))!.text()).toBe(
      "cached /how-to-play/",
    );
    expect(await (await sw.fetchEvent("/somewhere", { mode: "navigate" }))!.text()).toBe(
      "cached /",
    );
  });
  it("prefers the network for pages when it answers", async () => {
    const sw = run({ online: true });
    await sw.install();
    expect(await (await sw.fetchEvent("/", { mode: "navigate" }))!.text()).toBe("network /");
  });
  it("deletes older apex caches when it activates", async () => {
    const sw = run({ online: true });
    await sw.install();
    sw.stores.set("apex-old", new Map());
    sw.stores.set("other", new Map());
    let wait: Promise<unknown> = Promise.resolve();
    sw.fire("activate", { waitUntil: (p: Promise<unknown>) => (wait = p) });
    await wait;
    expect(sw.stores.has("apex-old")).toBe(false);
    expect(sw.stores.has("other")).toBe(true);
  });
});

describe("wiring", () => {
  it("the web build writes the worker after the info pages", () => {
    const build = JSON.parse(readFileSync(join(root, "apps/web/package.json"), "utf8")).scripts
      .build;
    expect(build.indexOf("write-sw.mjs")).toBeGreaterThan(build.indexOf("info-pages.mjs"));
  });
  it("the worker file is never cached by the browser or CDN", () => {
    expect(readFileSync(join(root, "apps/web/public/_headers"), "utf8")).toMatch(
      /\/sw\.js\n\s+Cache-Control: no-cache/,
    );
  });
});

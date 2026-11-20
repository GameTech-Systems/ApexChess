// Smoke test for a live deploy: home page, version, API, room create and join, WebSocket.
// Usage: node scripts/smoke.mjs <baseUrl> [expectedCommit]   (exit 1 on any failure)
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const setupFile = new URL("../rules/setups/default.json", import.meta.url);

function lock() {
  const setup = JSON.parse(readFileSync(setupFile, "utf8"));
  // protocol 2 (packages/online PROTOCOL); the standard ruleset and the default setup.
  return { protocol: 2, ruleset: { id: "standard", version: "0.1.0" }, setup: setup.pieces };
}

/** Opens the room socket and resolves once the first message arrives. */
function firstMessage(WebSocketImpl, url, ms) {
  return new Promise((ok, no) => {
    const ws = new WebSocketImpl(url);
    const timer = globalThis.setTimeout(() => (ws.close(), no(new Error("timed out"))), ms);
    ws.onmessage = (e) => (
      globalThis.clearTimeout(timer),
      ws.close(),
      ok(JSON.parse(String(e.data)))
    );
    ws.onerror = () => (globalThis.clearTimeout(timer), no(new Error("socket error")));
  });
}

export async function smoke(base, opts = {}) {
  const {
    expectCommit,
    fetchFn = globalThis.fetch,
    WebSocketImpl = globalThis.WebSocket,
    ms = 15000,
  } = opts;
  const root = base.replace(/\/$/, "");
  const failures = [];
  const check = async (name, fn) => {
    try {
      await fn();
    } catch (e) {
      failures.push(`${name}: ${e.message}`);
    }
  };
  const get = async (path, init) => {
    const res = await fetchFn(root + path, init);
    if (!res.ok) throw new Error(`${path} answered ${res.status}`);
    return res;
  };
  const post = (path, body) =>
    get(path, { method: "POST", headers: { "content-type": "application/json" }, body });

  await check("home", async () => {
    if (!(await (await get("/")).text()).includes("Apex Chess")) throw new Error("no title");
  });
  await check("info pages", async () => {
    const html = await (await get("/how-to-play/")).text();
    if (!html.includes('rel="canonical" href="https://apexchess.icu/how-to-play/"'))
      throw new Error("/how-to-play/ is not its own page");
  });
  await check("offline worker", async () => {
    const res = await get("/sw.js");
    if (
      !/javascript/.test(res.headers.get("content-type") ?? "") ||
      !(await res.text()).includes("PRECACHE")
    )
      throw new Error("/sw.js is not the offline worker");
  });
  await check("commit", async () => {
    const { commit } = await (await get("/version.json")).json();
    if (expectCommit && commit !== expectCommit)
      throw new Error(`live commit ${commit} is not ${expectCommit}`);
  });
  await check("api", async () => void (await get("/api/stats")).json());
  await check("room", async () => {
    const body = JSON.stringify(lock());
    const a = await (await post("/api/rooms", body)).json();
    if (!a.room || !a.token) throw new Error("create gave no ticket");
    const b = await (await post(`/api/rooms/${a.room}/join`, body)).json();
    if (!b.token) throw new Error("join gave no ticket");
    const wsBase = root.replace(/^http/, "ws");
    const msg = await firstMessage(
      WebSocketImpl,
      `${wsBase}/api/rooms/${a.room}/socket?token=${encodeURIComponent(a.token)}`,
      ms,
    );
    if (msg.type !== "state") throw new Error(`socket sent ${msg.type}`);
  });
  return { failures };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [base, commit] = process.argv.slice(2);
  if (!base) {
    console.error("usage: smoke.mjs <baseUrl> [commit]");
    process.exit(2);
  }
  const { failures } = await smoke(base, { expectCommit: commit });
  failures.forEach((f) => console.error("FAIL", f));
  console.log(failures.length ? "smoke: failed" : "smoke: ok");
  process.exit(failures.length ? 1 : 0);
}

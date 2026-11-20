/* global self, caches, fetch */
/* Apex Chess service worker. scripts/write-sw.mjs fills in the two placeholders and writes
   dist/sw.js. Provisional (D24): offline play only; online features still need a connection. */
const CACHE = "__CACHE__";
const PRECACHE = "__PRECACHE__";

self.addEventListener("install", (event) => {
  // No skipWaiting: a new worker takes over once the old tabs close, so a running page never
  // loses the hashed files it was built with.
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k.startsWith("apex-") && k !== CACHE).map((k) => caches.delete(k)),
        ),
      ),
  );
});

/** Pages: the network when it answers (so a deploy shows up), else the cached copy. */
async function page(request) {
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(request);
    if (res.ok) await cache.put(request, res.clone());
    return res;
  } catch (err) {
    const hit = (await cache.match(request, { ignoreSearch: true })) || (await cache.match("/"));
    if (hit) return hit;
    throw err;
  }
}

/** Files named by content hash (and the other build files): the cache, else the network. */
async function asset(request) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok) await cache.put(request, res.clone());
  return res;
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  // Online play, accounts, stats, and the deployed-commit check always go to the network.
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/") || url.pathname === "/version.json") return;
  event.respondWith(request.mode === "navigate" ? page(request) : asset(request));
});

// Write sw.js (offline play, D24) into a built folder: the template plus the precache list.
// Usage: node scripts/write-sw.mjs <dir>
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

/** Build files the worker must not cache: itself, the deploy check, host and crawler files. */
const SKIP = new Set(["sw.js", "version.json", "_headers", "robots.txt", "sitemap.xml"]);

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)],
  );
}

/** Site paths to precache for the files under `dir`; an index.html is served at its folder. */
export function precacheList(dir) {
  const paths = walk(dir)
    .map((f) => relative(dir, f).split(sep).join("/"))
    .filter((p) => !SKIP.has(p) && !p.endsWith(".map"))
    .map((p) => "/" + p.replace(/(^|\/)index\.html$/, "$1"));
  return [...new Set(paths)].sort();
}

export function buildServiceWorker(template, files, id) {
  return template
    .replace('"__CACHE__"', JSON.stringify(`apex-${id}`))
    .replace('"__PRECACHE__"', JSON.stringify(files));
}

export function writeServiceWorker(dir) {
  const files = precacheList(dir);
  const hash = createHash("sha256");
  for (const p of files) {
    const file = p.endsWith("/") ? p + "index.html" : p;
    hash.update(p).update(readFileSync(join(dir, file)));
  }
  const template = readFileSync(new URL("./sw.template.js", import.meta.url), "utf8");
  writeFileSync(
    join(dir, "sw.js"),
    buildServiceWorker(template, files, hash.digest("hex").slice(0, 12)),
  );
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  writeServiceWorker(resolve(process.argv[2] ?? "dist"));
}

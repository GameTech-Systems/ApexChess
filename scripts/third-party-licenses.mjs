// Collect the licenses of the third-party packages an app ships (its dependencies, followed through
// workspace packages and transitive dependencies) into one text file, so the copyright and license
// notices that MIT, BSD, and Apache-2.0 require travel with the built web app.
// Usage: node scripts/third-party-licenses.mjs <appDir> <outFile>
import { existsSync, readdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const LICENSE_FILE = /^(licen[cs]e|copying|notice)([.-].*)?$/i;

function readJson(p) {
  return JSON.parse(readFileSync(p, "utf8"));
}

/** Node-style lookup: the nearest node_modules/<name> at or above `fromDir`. */
function findPackage(fromDir, name) {
  for (let dir = fromDir; ; dir = dirname(dir)) {
    const candidate = join(dir, "node_modules", name);
    if (existsSync(join(candidate, "package.json"))) return realpathSync(candidate);
    if (dirname(dir) === dir) return undefined;
  }
}

function licenseOf(pkg) {
  if (typeof pkg.license === "string") return pkg.license;
  if (pkg.license && typeof pkg.license.type === "string") return pkg.license.type;
  if (Array.isArray(pkg.licenses)) return pkg.licenses.map((l) => l.type ?? l).join(" OR ");
  return "UNKNOWN";
}

function repoOf(pkg) {
  const r = pkg.repository;
  const url = typeof r === "string" ? r : r?.url;
  return (
    pkg.homepage ??
    (url
      ? String(url)
          .replace(/^git\+/, "")
          .replace(/\.git$/, "")
      : "")
  );
}

/**
 * Every non-workspace package reachable from the app's dependencies, sorted by name. Workspace
 * packages (version "workspace:*") are walked through but not listed.
 */
export function collectLicenses(appDir) {
  const found = new Map();
  const seen = new Set();
  const visit = (dir, isWorkspace) => {
    if (seen.has(dir)) return;
    seen.add(dir);
    const pkg = readJson(join(dir, "package.json"));
    if (!isWorkspace) {
      const files = readdirSync(dir)
        .filter((f) => LICENSE_FILE.test(f))
        .sort();
      found.set(`${pkg.name}@${pkg.version}`, {
        name: pkg.name,
        version: pkg.version,
        license: licenseOf(pkg),
        source: repoOf(pkg),
        texts: files.map((f) => readFileSync(join(dir, f), "utf8").trim()),
      });
    }
    for (const [name, range] of Object.entries(pkg.dependencies ?? {})) {
      const at = findPackage(dir, name);
      if (!at) throw new Error(`${pkg.name}: dependency ${name} is not installed`);
      visit(at, String(range).startsWith("workspace:"));
    }
  };
  visit(realpathSync(appDir), true);
  return [...found.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function formatLicenses(list) {
  const head = [
    "Third-party software in the Apex Chess web app",
    "",
    "Apex Chess itself is source-available under the PolyForm Shield License 1.0.0:",
    "https://github.com/GameTech-Systems/ApexChess",
    "The packages below are part of the app that runs in your browser. Each keeps its own",
    "license, reproduced here with its copyright notice.",
  ];
  const parts = list.map((p) =>
    [
      "-".repeat(72),
      `${p.name} ${p.version} (${p.license})`,
      p.source,
      "",
      p.texts.length
        ? p.texts.join("\n\n")
        : `No license file is included; the package declares ${p.license}.`,
    ]
      .filter((line, i) => i !== 2 || line)
      .join("\n"),
  );
  return [...head, "", ...parts, ""].join("\n");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [appDir, outFile] = process.argv.slice(2);
  if (!appDir || !outFile) {
    console.error("usage: node scripts/third-party-licenses.mjs <appDir> <outFile>");
    process.exit(2);
  }
  const list = collectLicenses(appDir);
  const missing = list.filter((p) => !p.texts.length).map((p) => p.name);
  writeFileSync(outFile, formatLicenses(list));
  console.log(
    `${outFile}: ${list.length} packages${missing.length ? `; no license file: ${missing.join(", ")}` : ""}`,
  );
}

// Write version.json (the deployed commit) into a built folder.
// Usage: node scripts/write-version.mjs <dir>
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export function versionJson(env, gitSha) {
  return { commit: env.GITHUB_SHA || gitSha || "unknown", builtAt: new Date().toISOString() };
}

export function writeVersion(dir, env = process.env) {
  let sha;
  try {
    sha = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  } catch {
    sha = undefined;
  }
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "version.json"), JSON.stringify(versionJson(env, sha)) + "\n");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  writeVersion(resolve(process.argv[2] ?? "dist"));
}

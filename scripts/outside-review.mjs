#!/usr/bin/env node
// Outside review: send the changes since the last review to open models on NVIDIA's build
// API (integrate.api.nvidia.com) and save each model's findings in docs/reviews/.
// In Claude Code cloud sessions the network proxy adds the key; elsewhere set NVIDIA_API_KEY.
// Usage: node scripts/outside-review.mjs [--model a/b,c/d] [--since <git ref>] [--focus "..."] [--dry-run]
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const DEFAULT_MODELS = ["moonshotai/kimi-k3.1-pro", "mistralai/mistral-large-4-1t-a52b"];
const ENDPOINT = "https://integrate.api.nvidia.com/v1/chat/completions";
const LAST = "docs/reviews/LAST";
const CAP = 60_000; // characters of material per request
const CORE = ["docs/RULES.md", "docs/HANDOFF.md"];
const NEVER = /(^|\/)\.env|\.dev\.vars|secret|credential|\.pem$|\.key$/i;

export function parseArgs(argv) {
  const out = { models: DEFAULT_MODELS, since: null, focus: "", dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--model") out.models = argv[++i].split(",").filter(Boolean);
    else if (a === "--since") out.since = argv[++i];
    else if (a === "--focus") out.focus = argv[++i];
    else if (a === "--dry-run") out.dryRun = true;
  }
  return out;
}

export function reportPath(date, model) {
  return `docs/reviews/${date}-${model.replace(/[^A-Za-z0-9._-]+/g, "-")}.md`;
}

const clip = (s, n) => (s.length > n ? s.slice(0, n) + "\n[truncated]" : s);

export function buildMessages({ focus, files, diff, cap = CAP }) {
  const system = [
    "You are an outside reviewer for Apex Chess, a chess variant on a standard 8x8 board turned 45 degrees",
    "(kings start in the light corners h1 and a8). Rules and setups are data under rules/; docs/RULES.md is the rules in words.",
    "Review for: correctness bugs, rules that the code does not follow, security and privacy problems,",
    "launch blockers, and missing tests. Rank findings most severe first. For each: severity (high/med/low),",
    "file and line, what goes wrong, and a concrete fix. Say whether you confirmed it from the text or only suspect it.",
    "Never invent rules: if a rule seems unclear, list it as a question for the owner. Skip style nits. Be brief.",
  ].join(" ");
  let budget = cap;
  const parts = [];
  if (focus) parts.push(`Focus: ${focus}`);
  if (diff) {
    const d = clip(diff, Math.floor(budget * 0.6));
    parts.push("Changes since the last review:\n```diff\n" + d + "\n```");
    budget -= d.length;
  }
  for (const f of files) {
    if (budget <= 0) break;
    const t = clip(f.text, budget);
    parts.push(`File ${f.path}:\n\`\`\`\n${t}\n\`\`\``);
    budget -= t.length;
  }
  return [
    { role: "system", content: system },
    { role: "user", content: parts.join("\n\n") },
  ];
}

const git = (...args) => execFileSync("git", args, { encoding: "utf8", maxBuffer: 64 << 20 });

function gather(since) {
  const tracked = (paths) =>
    git("ls-files", "--", ...paths)
      .split("\n")
      .filter((p) => p && !NEVER.test(p));
  let diff = "";
  let paths = CORE;
  if (since) {
    const changed = git("diff", "--name-only", `${since}..HEAD`).split("\n").filter(Boolean);
    const safe = changed.filter((p) => !NEVER.test(p) && !/lock\.yaml$|\.png$|\.ico$/.test(p));
    if (safe.length) diff = git("diff", `${since}..HEAD`, "--", ...safe);
  } else {
    paths = [...CORE, "packages/engine/src", "packages/online/src", "apps/server/src"];
  }
  const files = tracked(paths)
    .filter((p) => !p.includes(".test.") && existsSync(p))
    .map((p) => ({ path: p, text: readFileSync(p, "utf8") }));
  return { diff, files };
}

/** Joins the streamed (SSE) reply; streaming keeps the gateway from timing out on long reviews. */
export function readStream(raw) {
  let text = "";
  for (const line of raw.split("\n")) {
    if (!line.startsWith("data:")) continue;
    const data = line.slice(5).trim();
    if (!data || data === "[DONE]") continue;
    const j = JSON.parse(data);
    text += j.choices?.[0]?.delta?.content ?? "";
  }
  if (!text) throw new Error(raw.slice(0, 300));
  return text;
}

function ask(model, messages) {
  const key = process.env.NVIDIA_API_KEY || "proxy-injected";
  const body = JSON.stringify({
    model,
    messages,
    max_tokens: 8000,
    temperature: 0.2,
    stream: true,
  });
  const out = execFileSync(
    "curl",
    [
      "-sSN",
      "--max-time",
      "1200",
      ENDPOINT,
      "-H",
      `Authorization: Bearer ${key}`,
      "-H",
      "Content-Type: application/json",
      "--data-binary",
      "@-",
    ],
    { input: body, encoding: "utf8", maxBuffer: 64 << 20 },
  );
  return readStream(out);
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const since = opts.since ?? (existsSync(LAST) ? readFileSync(LAST, "utf8").trim() : null);
  const head = git("rev-parse", "--short", "HEAD").trim();
  const { diff, files } = gather(since);
  const messages = buildMessages({ focus: opts.focus, files, diff });
  const size = messages[1].content.length;
  console.log(
    `Review of ${since ? `${since}..${head}` : `the core files at ${head}`}: ${files.length} files, ${size} characters.`,
  );
  if (opts.dryRun) return;
  mkdirSync("docs/reviews", { recursive: true });
  const date = new Date().toISOString().slice(0, 10);
  let saved = 0;
  for (const model of opts.models) {
    try {
      const text = ask(model, messages);
      const path = reportPath(date, model);
      const scope = since ? `changes ${since}..${head}` : `core files at ${head}`;
      writeFileSync(
        path,
        `# Outside review: ${model}\n\n${date} · ${scope}${opts.focus ? ` · focus: ${opts.focus}` : ""}\n\nUnverified model output. Check each finding against the code before acting.\n\n${text.trim()}\n`,
      );
      console.log(`Saved ${path}`);
      saved++;
    } catch (e) {
      console.error(`Skipped ${model}: ${e.message}`);
    }
  }
  if (saved) writeFileSync(LAST, git("rev-parse", "HEAD"));
  else process.exitCode = 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();

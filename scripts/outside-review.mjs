#!/usr/bin/env node
// Outside review: send the changes since the last review to open models on NVIDIA's build
// API (integrate.api.nvidia.com) and save each model's findings in docs/reviews/.
// If every model hits a limit, it falls back to free OpenRouter models ("openrouter:<id>:free").
// In Claude Code cloud sessions the network proxy adds both keys; elsewhere set NVIDIA_API_KEY
// and OPENROUTER_API_KEY.
// Usage: node scripts/outside-review.mjs [--model a/b,c/d] [--since <git ref>] [--focus "..."] [--dry-run]
import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const DEFAULT_MODELS = ["moonshotai/kimi-k3.1-pro", "nvidia/nemotron-3-ultra-550b-a55b"];
/** Used when every default model hits a rate or daily limit. OpenRouter's free models only. */
export const FALLBACK_MODELS = [
  "openrouter:nvidia/nemotron-3-ultra-550b-a55b:free",
  "openrouter:google/gemma-4-31b-it:free",
];

/** Where a model name goes: plain names to NVIDIA, "openrouter:<id>:free" to OpenRouter. */
export function provider(name) {
  if (!name.startsWith("openrouter:"))
    return {
      url: "https://integrate.api.nvidia.com/v1/chat/completions",
      model: name,
      envKey: "NVIDIA_API_KEY",
    };
  const model = name.slice("openrouter:".length);
  if (!model.endsWith(":free")) throw new Error(`${model}: only OpenRouter models ending in :free`);
  return {
    url: "https://openrouter.ai/api/v1/chat/completions",
    model,
    envKey: "OPENROUTER_API_KEY",
  };
}

const LIMIT = /\b429\b|rate.?limit|quota|too many requests|limit exceeded/i;
export const shouldFallBack = (errors) =>
  errors.length > 0 && errors.every((e) => LIMIT.test(e.message));
const LAST = "docs/reviews/LAST";
const CAP = 40_000; // characters of material per request
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
    "You cannot run tools or ask for more files: answer now, in full, from the material given.",
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
  // Keep the order of `paths`, so the most important files come first under the cap.
  const tracked = (paths) =>
    paths.flatMap((p) =>
      git("ls-files", "--", p)
        .split("\n")
        .filter((q) => q && !NEVER.test(q)),
    );
  let diff = "";
  let paths = CORE;
  if (since) {
    const changed = git("diff", "--name-only", `${since}..HEAD`).split("\n").filter(Boolean);
    const safe = changed.filter((p) => !NEVER.test(p) && !/lock\.yaml$|\.png$|\.ico$/.test(p));
    if (safe.length) diff = git("diff", `${since}..HEAD`, "--", ...safe);
  } else {
    paths = [
      ...CORE,
      "packages/engine/src/ai.ts",
      "packages/engine/src/game.ts",
      "packages/engine/src",
      "packages/online/src",
      "apps/server/src",
    ];
  }
  const files = [...new Set(tracked(paths))]
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
    try {
      text += JSON.parse(data).choices?.[0]?.delta?.content ?? "";
    } catch {
      // a line cut off by the time limit
    }
  }
  if (!text) throw new Error(raw.slice(0, 300) || "empty reply");
  return text;
}

/** Asks one model; resolves with its reply, marked when the time limit cut it short. */
export function ask(name, messages, seconds = 1500) {
  let target;
  try {
    target = provider(name);
  } catch (e) {
    return Promise.reject(e);
  }
  const { url, model, envKey } = target;
  const key = process.env[envKey] || "proxy-injected";
  // Thinking off: with it on, these models spend the whole budget reasoning and time out.
  const thinkingOff = { thinking: false, enable_thinking: false };
  const body = JSON.stringify({
    model,
    messages,
    max_tokens: 6000,
    temperature: 0.2,
    stream: true,
    reasoning_effort: "low",
    ...(envKey === "NVIDIA_API_KEY"
      ? { chat_template_kwargs: thinkingOff }
      : { reasoning: { enabled: false } }),
  });
  const args = ["-sSN", "--max-time", String(seconds), url, "-H", `Authorization: Bearer ${key}`];
  args.push("-H", "Content-Type: application/json", "--data-binary", "@-");
  return new Promise((done, fail) => {
    const child = spawn("curl", args);
    let out = "";
    let err = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    child.on("close", (code) => {
      try {
        const text = readStream(out);
        done(code === 0 ? text : `${text}\n\n[Reply cut off: ${err.trim()}]`);
      } catch (e) {
        fail(new Error(`${err.trim()} ${e.message}`.trim()));
      }
    });
    child.stdin.end(body);
  });
}

async function main() {
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
  const scope = since ? `changes ${since}..${head}` : `core files at ${head}`;
  const run = async (models) => {
    const results = await Promise.allSettled(models.map((m) => ask(m, messages)));
    const errors = [];
    let saved = 0;
    results.forEach((r, i) => {
      const model = models[i];
      if (r.status === "rejected") {
        errors.push(r.reason);
        return console.error(`Skipped ${model}: ${r.reason.message}`);
      }
      const path = reportPath(date, model);
      const head1 = `# Outside review: ${model}\n\n${date} · ${scope}${opts.focus ? ` · focus: ${opts.focus}` : ""}`;
      const note = "Unverified model output. Check each finding against the code before acting.";
      writeFileSync(path, `${head1}\n\n${note}\n\n${r.value.trim()}\n`);
      console.log(`Saved ${path}`);
      saved++;
    });
    return { saved, errors };
  };
  let { saved, errors } = await run(opts.models);
  if (!saved && shouldFallBack(errors)) {
    console.log("Every model hit a limit: trying OpenRouter's free models.");
    ({ saved } = await run(FALLBACK_MODELS));
  }
  if (saved) writeFileSync(LAST, git("rev-parse", "HEAD"));
  else process.exitCode = 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();

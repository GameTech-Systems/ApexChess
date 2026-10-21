/**
 * `pnpm sim`: bot self-play across a setup pool, then a report. Splits the games over child
 * processes; each game's seed fixes it, so the split never changes the results.
 */
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { availableParallelism } from "node:os";
import { catalog, resolveRuleset, seededRandom } from "@apexchess/engine";
import { buildReport, toMarkdown, type PlayedGame } from "./report";
import {
  runShard,
  setupPool,
  type GameOutcome,
  type RunConfig,
  type ScheduledGame,
} from "./selfplay";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
// Defaults are the design in docs/decisions/0003-self-play-measures.md.
const { values } = parseArgs({
  args: process.argv.slice(2).filter((a) => a !== "--"),
  options: {
    ruleset: { type: "string", default: "standard" },
    pool: { type: "string", default: "8" },
    games: { type: "string", default: "10" },
    depth: { type: "string", default: "2" },
    nodes: { type: "string", default: "3000" },
    seed: { type: "string", default: "1" },
    cap: { type: "string", default: "400" },
    jobs: { type: "string", default: String(availableParallelism()) },
    out: { type: "string", default: "sim-out" },
    report: { type: "string" },
    shard: { type: "string" },
  },
});
const ruleset = resolveRuleset(catalog, values.ruleset);
const config: RunConfig = {
  poolSize: Number(values.pool),
  gamesPerPairing: Number(values.games),
  seed: Number(values.seed),
  bot: { depth: Number(values.depth), maxNodes: Number(values.nodes) },
  maxPlies: Number(values.cap),
};
const jobs = Math.max(1, Number(values.jobs));
type Game = ScheduledGame & GameOutcome;

if (values.shard !== undefined) {
  runShard(ruleset, config, Number(values.shard), jobs, (g) =>
    process.stdout.write(JSON.stringify(g) + "\n"),
  );
} else {
  const total = config.poolSize ** 2 * config.gamesPerPairing;
  const games: Game[] = [];
  const started = Date.now();
  await Promise.all(
    Array.from({ length: jobs }, (_, shard) => {
      // Under vite-node, argv[1] is vite-node itself and the script path is not in argv.
      const script = fileURLToPath(import.meta.url);
      const args = [
        process.argv[1]!,
        script,
        "--",
        ...process.argv.slice(2),
        "--shard",
        String(shard),
      ];
      const child = spawn(process.execPath, args, { stdio: ["ignore", "pipe", "inherit"] });
      let buffer = "";
      child.stdout.on("data", (chunk: Buffer) => {
        buffer += chunk.toString();
        const lines = buffer.split("\n");
        buffer = lines.pop()!;
        for (const line of lines) {
          games.push(JSON.parse(line) as Game);
          if (games.length % 10 === 0 || games.length === total)
            process.stderr.write(
              `${games.length}/${total} games, ${Math.round((Date.now() - started) / 1000)} s\n`,
            );
        }
      });
      return new Promise<void>((done, fail) =>
        child.on("exit", (code) =>
          code ? fail(new Error(`shard ${shard} exited with ${code}`)) : done(),
        ),
      );
    }),
  );
  games.sort((a, b) => a.index - b.index);
  if (games.length !== total) throw new Error(`expected ${total} games, got ${games.length}`);
  const pool = setupPool(ruleset, config.poolSize, seededRandom(config.seed));
  const meta = { bot: config.bot, seed: config.seed, maxPlies: config.maxPlies };
  const played: PlayedGame[] = games.map(({ index, light, dark, result, plies, capped }) => ({
    index,
    light,
    dark,
    result,
    plies,
    capped,
  }));
  const report = buildReport(ruleset, pool, played, meta, {
    minGames: 30,
    alpha: 0.05,
    capWarning: 0.05,
  });
  const out = resolve(root, values.out);
  mkdirSync(out, { recursive: true });
  writeFileSync(resolve(out, "games.jsonl"), games.map((g) => JSON.stringify(g)).join("\n") + "\n");
  writeFileSync(resolve(out, "report.json"), JSON.stringify(report, null, 2) + "\n");
  const md = toMarkdown(report);
  writeFileSync(resolve(root, values.report ?? `${values.out}/report.md`), md);
  process.stderr.write(`done in ${Math.round((Date.now() - started) / 1000)} s\n`);
}

import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Worker } from "node:worker_threads";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  catalog,
  legalMoves,
  moveText,
  newGame,
  resolveRuleset,
  startPosition,
} from "../../packages/engine/src/index";

const root = join(__dirname, "..", "..");
const ruleset = resolveRuleset(catalog, "standard");
const preset = catalog.setups[0]!.pieces;

// Node has no `self`, `onmessage` or `postMessage` for a worker; this lets the built, minified
// worker file run unchanged, the way a browser's module worker would.
const SHIM = `const { parentPort } = require("node:worker_threads");
globalThis.self = globalThis;
globalThis.postMessage = (m) => parentPort.postMessage(m);
parentPort.on("message", (d) => globalThis.onmessage({ data: d }));
`;

describe("the built computer worker", () => {
  let dist = "";
  let workerFile = "";
  const workers: Worker[] = [];

  beforeAll(() => {
    dist = mkdtempSync(join(tmpdir(), "web-build-"));
    execFileSync(
      "pnpm",
      ["--filter", "@apexchess/web", "exec", "vite", "build", "--outDir", dist, "--emptyOutDir"],
      { cwd: root, stdio: "pipe" },
    );
    const files = readdirSync(join(dist, "assets")).filter((f) =>
      /^computer\.worker-.*\.js$/.test(f),
    );
    expect(files).toHaveLength(1);
    workerFile = join(dist, "assets", files[0]!);
  }, 120_000);

  afterAll(() => void workers.forEach((w) => w.terminate()));

  it("is referenced by the app bundle, so the page can find it", () => {
    const name = workerFile.split("/").pop()!;
    const app = readdirSync(join(dist, "assets")).filter((f) => /^index-.*\.js$/.test(f));
    expect(app.some((f) => readFileSync(join(dist, "assets", f), "utf8").includes(name))).toBe(
      true,
    );
  });

  it("answers a request with a legal move for every level", async () => {
    const game = newGame(ruleset, startPosition(ruleset, preset, preset));
    const legal = legalMoves(ruleset, game.position).map(moveText);
    for (const level of ["random", "easy", "medium", "hard"]) {
      const worker = new Worker(SHIM + readFileSync(workerFile, "utf8"), { eval: true });
      workers.push(worker);
      const reply = new Promise<Parameters<typeof moveText>[0] | null>((ok, no) => {
        worker.once("message", ok);
        worker.once("error", no);
      });
      worker.postMessage({ ruleset, game, level, seed: 4 });
      const move = await reply;
      expect(move, level).not.toBeNull();
      expect(legal, level).toContain(moveText(move!));
    }
  }, 60_000);
});

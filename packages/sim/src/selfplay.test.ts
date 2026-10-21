import {
  canonicalSetupId,
  catalog,
  checkSetup,
  replay,
  resolveRuleset,
  result,
  seededRandom,
} from "@apexchess/engine";
import { describe, expect, it } from "vitest";
import { playGame, runShard, schedule, setupPool } from "./selfplay";

const ruleset = resolveRuleset(catalog, "standard");
const bot = { depth: 1, maxNodes: 300 };

describe("setupPool", () => {
  it("starts with the default preset and holds distinct legal setup families", () => {
    const pool = setupPool(ruleset, 6, seededRandom(1));
    expect(pool).toHaveLength(6);
    expect(pool[0]).toEqual(ruleset.setup.default.pieces);
    for (const p of pool) expect(checkSetup(ruleset, "light", p)).toEqual([]);
    expect(new Set(pool.map((p) => canonicalSetupId(ruleset, p))).size).toBe(6);
  });
});

describe("schedule", () => {
  it("plays every ordered pair, same-setup pairs included, with one seed per game", () => {
    const games = schedule(3, 2, 100);
    expect(games).toHaveLength(18);
    expect(games.map((g) => g.index)).toEqual([...Array(18).keys()]);
    expect(games.map((g) => g.seed)).toEqual(games.map((g) => 100 + g.index));
    const pairs = new Map<string, number>();
    for (const g of games)
      pairs.set(`${g.light}-${g.dark}`, (pairs.get(`${g.light}-${g.dark}`) ?? 0) + 1);
    expect(pairs.size).toBe(9);
    expect([...pairs.values()].every((n) => n === 2)).toBe(true);
  });
});

describe("playGame", () => {
  const d = ruleset.setup.default.pieces;

  it("stops at the ply cap and counts the game as capped", () => {
    const g = playGame(ruleset, d, d, bot, seededRandom(1), 6);
    expect(g.plies).toBe(6);
    expect(g.capped).toBe(true);
    expect(g.result).toEqual({ status: "ongoing" });
  });

  it("keeps a record that replays to the same game", () => {
    const g = playGame(ruleset, d, d, bot, seededRandom(2), 30);
    expect(g.record.ruleset).toEqual({ id: ruleset.id, version: ruleset.version });
    expect(g.record.setups).toEqual({ light: d, dark: d });
    expect(g.record.moves).toHaveLength(g.plies);
    expect(result(ruleset, replay(ruleset, g.record))).toEqual(g.result);
  });

  it("is deterministic for a seed", () => {
    const a = playGame(ruleset, d, d, bot, seededRandom(3), 20);
    const b = playGame(ruleset, d, d, bot, seededRandom(3), 20);
    expect(a.record.moves).toEqual(b.record.moves);
  });
});

describe("runShard", () => {
  it("splits a run across shards without changing any game", () => {
    const config = { poolSize: 2, gamesPerPairing: 1, seed: 5, bot, maxPlies: 8 };
    const whole = runShard(ruleset, config, 0, 1);
    const parts = [...runShard(ruleset, config, 0, 2), ...runShard(ruleset, config, 1, 2)].sort(
      (a, b) => a.index - b.index,
    );
    expect(whole).toHaveLength(4);
    expect(parts).toEqual(whole);
  });
});

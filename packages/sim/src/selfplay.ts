/** Bot self-play: a setup pool, a round-robin schedule, and reproducible games with full records. */
import {
  bestMove,
  canonicalSetupId,
  moveText,
  newGame,
  newRecord,
  play,
  result,
  seededRandom,
  startPosition,
  type GameRecord,
  type Pieces,
  type Random,
  type ResolvedRuleset,
  type Result,
} from "@apexchess/engine";
import { randomSetup } from "./setups";

export interface Bot {
  depth: number;
  maxNodes: number;
}

export interface RunConfig {
  poolSize: number;
  gamesPerPairing: number;
  seed: number;
  bot: Bot;
  maxPlies: number;
}

export interface ScheduledGame {
  index: number;
  /** Pool indexes of light's and dark's setups. */
  light: number;
  dark: number;
  seed: number;
}

export interface GameOutcome {
  record: GameRecord;
  result: Result;
  plies: number;
  /** Stopped at the ply cap with the game still going. */
  capped: boolean;
}

/** The default preset, then random setups from distinct families, `size` in all. */
export function setupPool(ruleset: ResolvedRuleset, size: number, random: Random): Pieces[] {
  const pool: Pieces[] = [{ ...ruleset.setup.default.pieces }];
  const ids = new Set([canonicalSetupId(ruleset, pool[0]!)]);
  for (let tries = 0; pool.length < size; tries++) {
    if (tries > 1000 * size) throw new Error(`could not find ${size} distinct setup families`);
    const p = randomSetup(ruleset, random);
    const id = canonicalSetupId(ruleset, p);
    if (ids.has(id)) continue;
    ids.add(id);
    pool.push(p);
  }
  return pool.slice(0, size);
}

/** Every ordered (light, dark) pair of pool setups, same-setup pairs included, `games` times. */
export function schedule(poolSize: number, games: number, seed: number): ScheduledGame[] {
  const out: ScheduledGame[] = [];
  for (let g = 0; g < games; g++)
    for (let light = 0; light < poolSize; light++)
      for (let dark = 0; dark < poolSize; dark++)
        out.push({ index: out.length, light, dark, seed: seed + out.length });
  return out;
}

export function playGame(
  ruleset: ResolvedRuleset,
  light: Pieces,
  dark: Pieces,
  bot: Bot,
  random: Random,
  maxPlies: number,
): GameOutcome {
  let game = newGame(ruleset, startPosition(ruleset, light, dark));
  const record = newRecord(ruleset, light, dark);
  let r = result(ruleset, game);
  while (r.status === "ongoing" && record.moves.length < maxPlies) {
    const move = bestMove(ruleset, game, { ...bot, random })!;
    game = play(ruleset, game, move);
    record.moves.push(moveText(move));
    r = result(ruleset, game);
  }
  return { record, result: r, plies: record.moves.length, capped: r.status === "ongoing" };
}

/** The games of shard `shard` of `shards` (every `shards`-th game), each with its own seed. */
export function runShard(
  ruleset: ResolvedRuleset,
  config: RunConfig,
  shard: number,
  shards: number,
  onGame?: (game: ScheduledGame & GameOutcome) => void,
): (ScheduledGame & GameOutcome)[] {
  const pool = setupPool(ruleset, config.poolSize, seededRandom(config.seed));
  const out: (ScheduledGame & GameOutcome)[] = [];
  for (const s of schedule(config.poolSize, config.gamesPerPairing, config.seed)) {
    if (s.index % shards !== shard) continue;
    const outcome = playGame(
      ruleset,
      pool[s.light]!,
      pool[s.dark]!,
      config.bot,
      seededRandom(s.seed),
      config.maxPlies,
    );
    const game = { ...s, ...outcome };
    onGame?.(game);
    out.push(game);
  }
  return out;
}

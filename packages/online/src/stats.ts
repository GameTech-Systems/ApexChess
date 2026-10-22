/**
 * Public setup statistics (S19b, D18 default, provisional; see docs/decisions/0006): the 0003
 * measures over archived games, one JSON snapshot per ruleset id and version. Aggregates only:
 * no row under the floor, and nothing that names a single game.
 */
import type { Pieces, ResolvedRuleset } from "@apexchess/engine";
import { aggregate, type Row, type ScoredGame, type Summary } from "@apexchess/sim";
import { ARCHIVE_FORMAT } from "./archive";
import type { RulesetRef } from "./protocol";

/** Bump when the snapshot's shape changes. */
export const STATS_FORMAT = 1;

/** D18 default (provisional): rows need 30 games; games need 10 plies; Bonferroni at α = 0.05. */
export const STATS_OPTIONS = { minGames: 30, minPlies: 10, alpha: 0.05 };

/** A Summary as JSON: z is null when the standard error is 0 (score tells its sign). */
export type StatsSummary = Omit<Summary, "z"> & { z: number | null };
export type StatsRow = Omit<Row, "summary"> & { summary: StatsSummary };

export interface StatsSnapshot {
  format: number;
  ruleset: RulesetRef;
  /** Last UTC day counted, `YYYY-MM-DD`. */
  asOf: string;
  /** Games counted (at least `minPlies` plies). */
  games: number;
  options: typeof STATS_OPTIONS;
  /** Light's view; null under the floor. */
  firstMove: { all: StatsSummary | null; sameSetup: StatsSummary | null };
  families: StatsRow[];
  features: StatsRow[];
  /** Bonferroni |z| bar for each table, over the rows shown. */
  zCritical: { families: number; features: number };
}

/** An archive row as read back: `format`, `setup_light`, `setup_dark`, `plies`, `status`, `winner`. */
export type StatsInput = Record<string, unknown>;

const json = (s: Summary): StatsSummary => ({ ...s, z: Number.isFinite(s.z) ? s.z : null });
const jsonRow = (r: Row): StatsRow => ({ ...r, summary: json(r.summary) });

/** Light's score, or undefined for a row statistics cannot read. */
function lightScore(row: StatsInput): number | undefined {
  if (row.status === "draw") return 0.5;
  if (row.status !== "checkmate" && row.status !== "resigned") return undefined;
  return row.winner === "light" ? 1 : row.winner === "dark" ? 0 : undefined;
}

/**
 * The snapshot for one ruleset version from its archived rows, or undefined when no game counts.
 * When ARCHIVE_FORMAT changes, read the older formats here too.
 */
export function statsSnapshot(
  ruleset: ResolvedRuleset,
  rows: StatsInput[],
  asOf: string,
  options = STATS_OPTIONS,
): StatsSnapshot | undefined {
  const pool: Pieces[] = [];
  const index = new Map<string, number>();
  const at = (text: unknown) => {
    const pieces = JSON.parse(String(text)) as Pieces;
    const key = JSON.stringify(Object.entries(pieces).sort());
    if (!index.has(key)) index.set(key, pool.push(pieces) - 1);
    return index.get(key)!;
  };
  const games: ScoredGame[] = [];
  for (const row of rows) {
    const score = lightScore(row);
    if (
      row.format !== ARCHIVE_FORMAT ||
      Number(row.plies) < options.minPlies ||
      score === undefined
    )
      continue;
    games.push({ light: at(row.setup_light), dark: at(row.setup_dark), score });
  }
  if (!games.length) return undefined;
  const agg = aggregate(ruleset, pool, games, options);
  const floor = (s: Summary | null) => (s && s.n >= options.minGames ? json(s) : null);
  return {
    format: STATS_FORMAT,
    ruleset: { id: ruleset.id, version: ruleset.version },
    asOf,
    games: games.length,
    options,
    firstMove: { all: floor(agg.firstMove.all), sameSetup: floor(agg.firstMove.sameSetup) },
    families: agg.families
      .map(jsonRow)
      .sort((a, b) => b.summary.n - a.summary.n || (a.label < b.label ? -1 : 1)),
    features: agg.features.map(jsonRow),
    zCritical: agg.zCritical,
  };
}

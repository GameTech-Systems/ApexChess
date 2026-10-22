/**
 * The daily statistics job and its reads (S19b; docs/decisions/0006). Snapshots are built by the
 * pure statsSnapshot in @apexchess/online and stored in table `stats` (migrations/0002_stats.sql).
 */
import { catalog, resolveRuleset } from "@apexchess/engine";
import { STATS_OPTIONS, statsSnapshot, type RulesetRef } from "@apexchess/online";

type Db = Pick<D1Database, "prepare">;

export interface StatsListing {
  ruleset: RulesetRef;
  asOf: string;
  games: number;
}

const day = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/**
 * Rebuild every ruleset version's snapshot from whole UTC days before `now`, so a snapshot stays
 * the same all day. Returns how many were written. Rebuilt in full each day (provisional): if the
 * archive outgrows the Worker's CPU limit, keep per-day tallies instead, since they add up.
 */
export async function refreshStats(db: Db, now: number): Promise<number> {
  const today = day(now);
  const asOf = day(Date.parse(`${today}T00:00:00Z`) - 1);
  const { results: versions } = await db
    .prepare("SELECT DISTINCT ruleset_id, ruleset_version FROM games")
    .all<{ ruleset_id: string; ruleset_version: string }>();
  let written = 0;
  for (const { ruleset_id: id, ruleset_version: version } of versions) {
    let ruleset;
    try {
      ruleset = resolveRuleset(catalog, id, version);
    } catch {
      console.error("stats: no ruleset", id, version);
      continue;
    }
    const { results } = await db
      .prepare(
        "SELECT format, setup_light, setup_dark, plies, status, winner FROM games" +
          " WHERE ruleset_id = ? AND ruleset_version = ? AND end_day < ? AND plies >= ?",
      )
      .bind(id, version, today, STATS_OPTIONS.minPlies)
      .all<Record<string, unknown>>();
    const snap = statsSnapshot(ruleset, results, asOf);
    if (!snap) continue;
    await db
      .prepare(
        "INSERT INTO stats (ruleset_id, ruleset_version, as_of, games, snapshot) VALUES (?, ?, ?, ?, ?)" +
          " ON CONFLICT (ruleset_id, ruleset_version) DO UPDATE SET" +
          " as_of = excluded.as_of, games = excluded.games, snapshot = excluded.snapshot",
      )
      .bind(id, version, snap.asOf, snap.games, JSON.stringify(snap))
      .run();
    written++;
  }
  return written;
}

/** Every published snapshot, without its tables. */
export async function listStats(db: Db): Promise<StatsListing[]> {
  const { results } = await db
    .prepare(
      "SELECT ruleset_id, ruleset_version, as_of, games FROM stats ORDER BY ruleset_id, ruleset_version",
    )
    .all<{ ruleset_id: string; ruleset_version: string; as_of: string; games: number }>();
  return results.map((r) => ({
    ruleset: { id: r.ruleset_id, version: r.ruleset_version },
    asOf: r.as_of,
    games: r.games,
  }));
}

/** One snapshot's JSON text, or null. */
export async function getStats(db: Db, id: string, version: string): Promise<string | null> {
  const row = await db
    .prepare("SELECT snapshot FROM stats WHERE ruleset_id = ? AND ruleset_version = ?")
    .bind(id, version)
    .first<{ snapshot: string }>();
  return row?.snapshot ?? null;
}

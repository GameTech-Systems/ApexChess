/** Ratings in D1 (S19d; table in migrations/0005_ratings.sql). The maths is glicko2 in @apexchess/online. */
import {
  NEW_RATING,
  SHOW_RD,
  glicko2,
  ratingText,
  type Leaderboard,
  type RatedGame,
  type Rating,
} from "@apexchess/online";

type Db = Pick<D1Database, "prepare" | "batch">;
type Row = { id: string; rating: number | null; rd: number; volatility: number; games: number };

/**
 * Update both players' ratings after one game, each from the other's rating before it. A game whose
 * account was deleted meanwhile scores nothing, so no row comes back for a deleted account.
 */
export async function rateGame(db: Db, game: RatedGame): Promise<void> {
  const { results } = await db
    .prepare(
      "SELECT a.id, r.rating, r.rd, r.volatility, r.games FROM accounts a LEFT JOIN ratings r" +
        " ON r.account_id = a.id AND r.ruleset_id = ? WHERE a.id IN (?, ?)",
    )
    .bind(game.ruleset, game.light, game.dark)
    .all<Row>();
  const old = (id: string) => results.find((r) => r.id === id);
  const light = old(game.light);
  const dark = old(game.dark);
  if (!light || !dark) return;
  const rating = (r: Row): Rating =>
    r.rating === null ? NEW_RATING : { rating: r.rating, rd: r.rd, volatility: r.volatility };
  const upsert = (r: Row, opponent: Row, score: number) => {
    const next = glicko2(rating(r), [{ opponent: rating(opponent), score }]);
    return db
      .prepare(
        "INSERT INTO ratings (account_id, ruleset_id, rating, rd, volatility, games)" +
          " VALUES (?, ?, ?, ?, ?, 1) ON CONFLICT (account_id, ruleset_id) DO UPDATE SET" +
          " rating = excluded.rating, rd = excluded.rd, volatility = excluded.volatility," +
          " games = games + 1",
      )
      .bind(r.id, game.ruleset, next.rating, next.rd, next.volatility);
  };
  await db.batch([upsert(light, dark, game.score), upsert(dark, light, 1 - game.score)]);
}

/** An account's ratings, one per ruleset id, with the text players see ("?" while RD > 110). */
export async function ratingsOf(db: Db, accountId: string) {
  const { results } = await db
    .prepare(
      "SELECT ruleset_id, rating, rd, volatility, games FROM ratings WHERE account_id = ?" +
        " ORDER BY ruleset_id",
    )
    .bind(accountId)
    .all<Rating & { ruleset_id: string; games: number }>();
  return results.map((r) => ({
    ruleset: r.ruleset_id,
    rating: r.rating,
    rd: r.rd,
    games: r.games,
    text: ratingText(r),
  }));
}

/** Players per leaderboard (S20d, provisional). */
export const LEADERBOARD_SIZE = 50;

/**
 * One leaderboard per ruleset id (S20d): accounts that turned listing on, with a settled rating
 * (RD ≤ 110), best first. Each entry is the handle, the rounded rating, and the rated-game count.
 */
export async function leaderboards(db: Db, size = LEADERBOARD_SIZE): Promise<Leaderboard[]> {
  const { results } = await db
    .prepare(
      "SELECT ruleset_id, handle, rating, games FROM (SELECT r.ruleset_id, a.handle, r.rating," +
        " r.games, ROW_NUMBER() OVER (PARTITION BY r.ruleset_id ORDER BY r.rating DESC," +
        " a.handle_key) AS place FROM ratings r JOIN accounts a ON a.id = r.account_id" +
        " WHERE a.listed = 1 AND r.rd <= ?) WHERE place <= ? ORDER BY ruleset_id, place",
    )
    .bind(SHOW_RD, size)
    .all<{ ruleset_id: string; handle: string; rating: number; games: number }>();
  const boards: Leaderboard[] = [];
  for (const r of results) {
    if (boards.at(-1)?.ruleset !== r.ruleset_id)
      boards.push({ ruleset: r.ruleset_id, players: [] });
    boards.at(-1)!.players.push({ handle: r.handle, rating: Math.round(r.rating), games: r.games });
  }
  return boards;
}

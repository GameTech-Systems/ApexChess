# 0006: Accounts, ratings, and public setup statistics

Date: 2026-10-22 · Status: accepted for S19a to S19c. D16 decided by the owner (passkey + handle, no email; minimum age 13, 2026-10-22). D17 and D18 are open; their defaults below are provisional until the owner decides.

## Order of work

Public setup statistics do not need accounts, so they come first. Accounts and ratings follow only when the owner chooses them.

1. **S19a: anonymous game archive.** When an online game ends, the server writes one record to Cloudflare D1 (fits D11): ruleset id and version, both setups, the moves, the result and reason, and the day it ended. It writes no seat token, room code, IP address, or time of day. The Privacy page changes in the same PR. Rooms are still deleted after 7 days. Built in S19a: table `games` (`apps/server/migrations/0001_archive.sql`, row id random), written once per game from `archiveRecord` in `@apexchess/online`; `/api` is rate-limited to 60 requests per address per minute (Workers rate-limit binding, provisional).
2. **S19b: public setup statistics.** A daily job aggregates the archive with the measures in 0003 (families, features, first-move score, standard error, the N ≥ 30 floor, the Bonferroni bar). It publishes one JSON snapshot per ruleset id and version, and the web app adds a Stats page. Built in S19b: a daily cron (00:07 UTC) rebuilds table `stats` from whole UTC days before the run (`statsSnapshot` in `@apexchess/online`, measures shared with `packages/sim` via `aggregate`); `GET /api/stats` lists snapshots and `GET /api/stats/<id>/<version>` returns one. First-move rows also need N ≥ 30.
3. **S19c: accounts (D16).** Optional; anonymous play stays the same. Built in S19c: tables in `apps/server/migrations/0004_accounts.sql` (same D1 database), `/api/account/*` and `/api/reports` (`apps/server/src/accounts.ts`), Account and Terms pages. Sign-up needs a free handle, a yes to "13 or older" (no birth date is stored), and the Terms. Passkeys are discoverable (sign in without typing the handle). 8 recovery codes of 16 base32 characters (80 bits), stored as SHA-256, each used once; new codes replace old ones. Sessions: a random bearer token kept in the browser, stored as SHA-256, 30 days (provisional); expired sessions and challenges are deleted by the daily job. Delete account removes the account, passkeys, codes, and sessions at once. Handle policy (provisional, also used for event names): 3 to 20 ASCII letters, digits, _ and -, starting with a letter; compared without case, _ or -; reserved words and anything containing "apexchess", "admin", or "moderator" refused. Report path: anyone can report a handle with a listed reason (offensive, impersonation, personal-info); the row keeps the handle, reason, and day only. The owner reviews reports with `wrangler d1 execute apexchess-archive --remote --command "SELECT * FROM handle_reports"` and removes an account by deleting its rows (accounts, passkeys, recovery_codes, sessions).
4. **S19d: ratings (D17).** Built on the D17 default (provisional): Glicko-2 in `packages/online/src/ratings.ts`, table `ratings` (`apps/server/migrations/0005_ratings.sql`: rating, RD, volatility, games per account and ruleset id). Rated: quick match between two different signed-in accounts on a clocked or abandonment-only control (D19); untimed games are unrated. Each finished game is one rating period; no RD growth for inactivity. The quick-match message carries the session token; the room keeps each seat's account id until it is deleted. No game-to-account link table is kept (least data). Account deletion also deletes ratings; a game whose account is gone scores nothing.

## Privacy review

- **No retroactive change.** The Privacy page promises deletion after 7 days. Games are archived only after the new text ships. The site is not live yet, so no existing player is affected.
- **Anonymous by design.** An archived record holds game data only. With accounts, the link from a game to an account lives in a separate table, and deleting an account deletes those links; the game records remain and stay anonymous.
- **Aggregates only.** Statistics show rows only at N ≥ 30, with no individual games and no per-player rows. The 0003 floor also stops a rare personal setup from being traced to one player.
- **Least data for accounts.** Passkeys plus a chosen handle: no email, no password, no third-party sign-in. Recovery uses one-time codes shown at sign-up, so a lost device without its codes loses the account. That trade is stated on the page.
- **Before accounts ship:** rate limiting on `/api` (S19a), a handle policy with a report path, Terms with a minimum age of 13, and Privacy page text for accounts and deletion (all S19c).
- **Dependencies:** only `@simplewebauthn/server` and `@simplewebauthn/browser` (MIT), listed in NOTICE. Glicko-2 is written in-house and tested against the worked example in Glickman's paper.

## Open decisions and defaults

| ID | Question | Options | Default (provisional) |
|---|---|---|---|
| D16 | Sign-in | none; passkey + handle; email magic link; third-party OAuth | **Decided:** passkey + handle, no email; minimum age 13 (built in S19c) |
| D17 | Ratings | none; Elo; Glicko-2. Pools: per ruleset id, or per id and major version | Glicko-2 (start 1500, RD 350, τ 0.5), updated after every game. One pool per ruleset id. Only quick-match games between two signed-in players count. Ratings show "?" while RD > 110. |
| D18 | Public statistics | none; aggregates only; aggregates plus an anonymous game dataset | aggregates only, from finished online games of at least 10 plies, refreshed daily. No dataset is published. |

## Not decided here

- **Abandoned games.** Rated play needs a clock or an abandonment rule. D19 (0007) gives one: a time loss or an abandonment forfeit is scored like any result. A game that never ends is never scored (provisional until the owner confirms).
- **Profiles and leaderboards.** Private by default; a public leaderboard would be opt-in (S20 or later).
- **Why this order:** the project's question is which setups do well. Anonymous records answer it with the least personal data, and accounts add value mainly for ratings.

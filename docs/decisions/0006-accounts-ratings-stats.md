# 0006: Accounts, ratings, and public setup statistics

Date: 2026-10-22 · Status: proposed (S19, plan only). D16 to D18 are open; their defaults below are provisional until the owner decides.

## Order of work

Public setup statistics do not need accounts, so they come first. Accounts and ratings follow only when the owner chooses them.

1. **S19a: anonymous game archive.** When an online game ends, the server writes one record to Cloudflare D1 (fits D11): ruleset id and version, both setups, the moves, the result and reason, and the day it ended. It writes no seat token, room code, IP address, or time of day. The Privacy page changes in the same PR. Rooms are still deleted after 7 days. Built in S19a: table `games` (`apps/server/migrations/0001_archive.sql`, row id random), written once per game from `archiveRecord` in `@apexchess/online`; `/api` is rate-limited to 60 requests per address per minute (Workers rate-limit binding, provisional).
2. **S19b: public setup statistics.** A daily job aggregates the archive with the measures in 0003 (families, features, first-move score, standard error, the N ≥ 30 floor, the Bonferroni bar). It publishes one JSON snapshot per ruleset id and version, and the web app adds a Stats page.
3. **S19c: accounts (D16).** Optional; anonymous play stays the same.
4. **S19d: ratings (D17).** Needs S19c and a rule for abandoned games.

## Privacy review

- **No retroactive change.** The Privacy page promises deletion after 7 days. Games are archived only after the new text ships. The site is not live yet, so no existing player is affected.
- **Anonymous by design.** An archived record holds game data only. With accounts, the link from a game to an account lives in a separate table, and deleting an account deletes those links; the game records remain and stay anonymous.
- **Aggregates only.** Statistics show rows only at N ≥ 30, with no individual games and no per-player rows. The 0003 floor also stops a rare personal setup from being traced to one player.
- **Least data for accounts.** Passkeys plus a chosen handle: no email, no password, no third-party sign-in. Recovery uses one-time codes shown at sign-up, so a lost device without its codes loses the account. That trade is stated on the page.
- **Before accounts ship:** rate limiting on `/api` (none today), a handle policy (length, characters, reserved names, a report path), Terms with a minimum age (owner question), and Privacy page text for accounts and deletion.
- **Dependencies:** only `@simplewebauthn/server` and `@simplewebauthn/browser` (MIT), listed in NOTICE. Glicko-2 is written in-house and tested against the worked example in Glickman's paper.

## Open decisions and defaults

| ID | Question | Options | Default (provisional) |
|---|---|---|---|
| D16 | Sign-in | none; passkey + handle; email magic link; third-party OAuth | passkey + handle, built in S19c only after the owner confirms |
| D17 | Ratings | none; Elo; Glicko-2. Pools: per ruleset id, or per id and major version | Glicko-2 (start 1500, RD 350, τ 0.5), updated after every game. One pool per ruleset id. Only quick-match games between two signed-in players count. Ratings show "?" while RD > 110. |
| D18 | Public statistics | none; aggregates only; aggregates plus an anonymous game dataset | aggregates only, from finished online games of at least 10 plies, refreshed daily. No dataset is published. |

## Not decided here

- **Abandoned games.** Rated play needs a clock or an abandonment rule. Until the owner sets one, an unfinished rated game is never scored.
- **Profiles and leaderboards.** Private by default; a public leaderboard would be opt-in (S20 or later).
- **Why this order:** the project's question is which setups do well. Anonymous records answer it with the least personal data, and accounts add value mainly for ratings.

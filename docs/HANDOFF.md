# Handoff

Updated 2026-10-22 by S19d (Opus 5.5 · high). `/end-session` rewrites this file; keep it under 30 lines.

## State
- Phase 6 done. Ratings (D17 default, provisional): Glicko-2 per ruleset id, table `ratings` (migration 0005).
- Rated: quick match between two different signed-in accounts on a clocked or abandonment-only control; untimed unrated. Time losses and abandonment forfeits count; games that never end are not scored.
- No game-to-account link table: the room keeps seat account ids until it is deleted (7 days). Account deletion clears ratings.
- Checked end to end in `wrangler dev` (two signed-in seekers, resign, both ratings updated).
- Not live: S16 hosting steps plus the D1 database are still open.

## Next session
**S20d — Phase 7: Leaderboards** · Opus 5.5 · effort high
Set: `/model opus` · `/effort high`
Why: opt-in public listing needs a privacy design on top of ratings.
Start with: `/start-session S20d`

## Decisions in effect for the next step
- D16: passkey + handle, no email; minimum age 13 (decided).
- D17: Glicko-2 (1500/350/σ 0.06, τ 0.5), one pool per ruleset id, "?" while RD > 110 (default).
- Leaderboards: private by default, opt-in, per ruleset id (0006, 0007).

## Open questions for the owner
- D17 confirmation, including the abandoned-game rule above (default: as built).
- Before the first deploy: create D1 `apexchess-archive`, send Claude its id, apply migrations 0001 to 0005.

## Notes for Claude
- Ratings: `packages/online/src/ratings.ts` (maths, `ratedGame`), `isRated` in `room.ts`, D1 in `apps/server/src/ratings.ts`.
- Quick match sends `session` in the seek message (`parseSeek`); Lobby resolves it with `sessionAccount`.
- Never `pkill -f wrangler`; use `pkill -f "[w]rangler"`.

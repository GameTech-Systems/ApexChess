# Handoff

Updated 2026-10-22 by S20d (Opus 5.5 · high). `/end-session` rewrites this file; keep it under 30 lines.

## State
- Phase 7 done. Leaderboards (provisional): one opt-in switch per account (`accounts.listed`, migration 0006), off by default.
- A listed account shows handle, rounded rating, and rated games per ruleset id, only once RD ≤ 110; top 50. `/api/leaderboard` is `no-store` + `noindex`, so opting out is immediate.
- D1 `apexchess-archive` id is in `wrangler.jsonc`; the deploy workflow applies migrations 0001 to 0006.
- No Code step is left in `docs/BUILD-PLAN.md`. Owner steps S2, S3, S17 remain; the site is not live yet.

## Next session
**None planned** · Owner steps next (S3 hosting, then deploy)
Set: owner's choice when new steps are added to `docs/BUILD-PLAN.md`
Why: every Code step is done.
Start with: `/start-session <new step>`

## Decisions in effect
- D16: passkey + handle, no email; minimum age 13 (decided).
- D17: Glicko-2, one pool per ruleset id, "?" while RD > 110 (default).
- Leaderboards: opt-in per account, settled ratings only, top 50 (default, 0006).

## Open questions for the owner
- D17 confirmation, including the abandoned-game rule (default: as built).
- Leaderboard defaults above (default: as built).

## Notes for Claude
- Leaderboards: `leaderboards` in `apps/server/src/ratings.ts`, `listing` action in `accounts.ts`, `apps/web/src/Leaderboard.tsx`.
- Never `pkill -f wrangler`; use `pkill -f "[w]rangler"`.

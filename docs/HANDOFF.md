# Handoff

Updated 2026-10-22 by S19b (Opus 5.5 · high). `/end-session` rewrites this file; keep it under 30 lines.

## State
- Phase 6. A daily cron (00:07 UTC) aggregates the D1 archive with the 0003 measures into table `stats`; `/api/stats` serves the snapshots and the web app has a Statistics page. Verified on `wrangler dev`.
- Not live: S16 hosting steps plus the D1 database (see 0004) are still open.

## Next session
**S20 — Phase 7: Tournaments and growth** · Opus 5.5 · effort high
Set: `/model opus` · `/effort high`
Why: S19c and S19d wait on owner decisions; S20 has no plan yet, so plan it first.
Start with: `/start-session S20`

## Decisions in effect for the next step
- D18: aggregates only, N ≥ 30, games of at least 10 plies, daily (default, provisional, 0006).
- D11: Cloudflare, archive and stats in D1 (provisional).

## Open questions for the owner
- D16 sign-in, D17 ratings, minimum age: S19c and S19d stay blocked.
- Before the first deploy: create D1 `apexchess-archive` (dashboard: Storage & Databases → D1) and send Claude its id.

## Notes for Claude
- Measures: `aggregate` in `packages/sim/src/aggregate.ts`, used by the sim report and by `statsSnapshot` (`packages/online/src/stats.ts`). Job and reads: `apps/server/src/stats.ts`; tests run real SQL through `node:sqlite`.
- Stats are rebuilt in full each day; if the archive outgrows Worker CPU limits, switch to per-day tallies (they add up).
- Local cron: `wrangler dev --test-scheduled`, then `curl localhost:8787/cdn-cgi/handler/scheduled`. Never `pkill -f wrangler`; use `pkill -f "[w]rangler"`.

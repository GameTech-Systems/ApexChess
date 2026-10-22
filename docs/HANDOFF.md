# Handoff

Updated 2026-10-22 by S19a (Opus 5.5 · high). `/end-session` rewrites this file; keep it under 30 lines.

## State
- Phase 6. Finished online games are archived to D1 table `games` (anonymous, end day only); `/api` is rate-limited (60 per address per minute). Privacy page updated. Verified on `wrangler dev`.
- Not live: S16 hosting steps plus the D1 database (see 0004) are still open.

## Next session
**S19b — Public setup statistics** · Opus 5.5 · effort high
Set: `/model opus` · `/effort high`
Why: Statistics measures and a scheduled job; correctness of published numbers matters.
Start with: `/start-session S19b`

## Decisions in effect for the next step
- D18: aggregates only, N ≥ 30, finished games of at least 10 plies, daily, no dataset published (default, provisional, 0006).
- D11: Cloudflare; archive in D1 (provisional). Rate limit 60/min per address (provisional).

## Open questions for the owner
- D16 sign-in, D17 ratings, minimum age: S19c and S19d stay blocked. None blocking S19b.
- Owner: `wrangler d1 create apexchess-archive`, put its id in `wrangler.jsonc` before the first deploy (deploy fails on the placeholder).

## Notes for Claude
- Archive rows: `archiveRecord`/`archiveRow` in `packages/online/src/archive.ts`; columns in `apps/server/migrations/0001_archive.sql` (a test keeps them in step). Filter plies ≥ 10 at aggregation, not at write.
- `pnpm dev:server` applies local D1 migrations first. Query: `pnpm dlx wrangler@4 d1 execute apexchess-archive --local --command "SELECT ..."`.
- Never `pkill -f wrangler`; use `pkill -f "[w]rangler"`. `docs/` and `*.md` are ignored by prettier.

# Handoff

Updated 2026-10-22 by S19 (Opus 5.5 · high). `/end-session` rewrites this file; keep it under 30 lines.

## State
- Phase 6 planned (S19, plan only). Design and privacy review are in `docs/decisions/0006-accounts-ratings-stats.md`. Sub-steps S19a to S19d are in `docs/BUILD-PLAN.md`.
- Online play (S18) works on `wrangler dev`. Not live: the S16 owner hosting steps are still open.

## Next session
**S19a — Anonymous game archive** · Opus 5.5 · effort high
Set: `/model opus` · `/effort high`
Why: New stored data format, a Privacy page change, and rate limiting; mistakes there are costly.
Start with: `/start-session S19a`

## Decisions in effect for the next step
- D18: aggregates only, N ≥ 30, archive records carry no identity (default, provisional, 0006).
- D11: Cloudflare; use D1 for the archive (provisional).
- No retroactive archiving: games are stored only after the new Privacy text ships (0006).

## Open questions for the owner
- D16 sign-in, D17 ratings, and the minimum age; S19c and S19d are blocked on them. They don't block S19a or S19b.
- Abandoned games: no clock or abandonment rule. Default: the game waits, and unfinished games are never rated.
- S16 hosting steps (Cloudflare account, secrets, domain).

## Notes for Claude
- `pnpm dev:server` runs `wrangler dev` on 8787. Never `pkill -f wrangler`; use `pkill -f "[w]rangler"`.
- Write archive records once, at the game's end in `Room`, and keep the record builder a pure, tested function in `packages/online`.
- `docs/` and `*.md` are ignored by prettier.

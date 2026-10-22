# Handoff

Updated 2026-10-22 by S20a (Opus 5.5 · high). `/end-session` rewrites this file; keep it under 30 lines.

## State
- Phase 7. Online rooms and quick match have server-kept time controls (D19 decided): untimed, Fischer grid 1+0…30+20 (default 10+0), per move (30 s to 3 days), abandonment only (5 min). Presets are data in `rules/timeControls.json`.
- Flag fall ends the game by Durable Object alarm or on a late message; archive format 2 adds `time_control` (migration 0003). Protocol is 2.
- Not live: S16 hosting steps plus the D1 database (see 0004) are still open.

## Next session
**S20b — Phase 7: Share and replay** · Sonnet 5.5 · effort medium
Set: `/model sonnet` · `/effort medium`
Why: client-only links and a replay viewer; no server or decision work.
Start with: `/start-session S20b`

## Decisions in effect for the next step
- D18: no individual games published by the site; share links live only in the player's browser (0007).

## Open questions for the owner
- D19 preset list and grace time are Claude's choice (provisional); change `rules/timeControls.json` to adjust.
- D20 tournament format: Claude uses the 0007 defaults if unanswered. D16, D17, minimum age: S19c, S19d, S20d stay blocked.
- Before the first deploy: create D1 `apexchess-archive` and send Claude its id; apply migrations 0001 to 0003.

## Notes for Claude
- Clock logic: `packages/online/src/clock.ts` (pure); `room.ts` `tick`, `deadline`, `presence` take `now`. Stats skip abandoned games, count losses on time.
- Smoke test: `pnpm dev:server`, then create and join a `move30s` room; it ends on time after 30 s.
- Never `pkill -f wrangler`; use `pkill -f "[w]rangler"`.

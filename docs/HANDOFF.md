# Handoff

Updated 2026-10-22 by S20 (Opus 5.5 · high). `/end-session` rewrites this file; keep it under 30 lines.

## State
- Phase 7 planned (plan only): `docs/decisions/0007-tournaments-growth.md` defines S20a clocks, S20b share and replay, S20c tournaments, and S20d leaderboards (blocked).
- Not live: S16 hosting steps plus the D1 database (see 0004) are still open.

## Next session
**S20a — Phase 7: Clocks** · Opus 5.5 · effort high
Set: `/model opus` · `/effort high`
Why: server-kept clocks are correctness-critical, and tournaments need them.
Start with: `/start-session S20a`

## Decisions in effect for the next step
- D19: Fischer presets 3+2, 5+3, 10+5, 15+10 plus untimed; running out of time loses unless the opponent has insufficient material (default, provisional, 0007).
- D8: draws as decided; its insufficient-material test also decides flag-fall draws.

## Open questions for the owner
- D19 time controls and D20 tournament format: Claude uses the 0007 defaults if unanswered.
- D16 sign-in, D17 ratings, minimum age: S19c, S19d, and S20d stay blocked.
- Before the first deploy: create D1 `apexchess-archive` and send Claude its id.

## Notes for Claude
- Rooms: `packages/online/src/room.ts` (pure) and the `Room` Durable Object in `apps/server`. Clock logic stays pure and is tested with injected time.
- Add the time control and the `time` result reason to `archiveRecord`; a D1 migration may be needed.
- Never `pkill -f wrangler`; use `pkill -f "[w]rangler"`.

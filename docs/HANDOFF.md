# Handoff

Updated 2026-10-22 by S20b (Sonnet 5.5 · medium). `/end-session` rewrites this file; keep it under 30 lines.

## State
- Phase 7. Online rooms and quick match have server-kept time controls (D19 decided): untimed, Fischer grid 1+0…30+20 (default 10+0), per move (30 s to 3 days), abandonment only (5 min). Presets are data in `rules/timeControls.json`.
- Share and replay done: `#setup=<code>` opens the builder with that setup; `#game=<base64url>` opens a replay viewer. Links are built in the browser (`apps/web/src/share.ts`) and live in the URL fragment, so the server never sees them. Buttons: "Copy setup link", "Copy game link" (local and online games), "Replay".
- Not live: S16 hosting steps plus the D1 database (see 0004) are still open.

## Next session
**S20c — Phase 7: Tournaments** · Opus 5.5 · effort high
Set: `/model opus` · `/effort high`
Why: pairing, tiebreaks, and event storage need careful design and correctness.
Start with: `/start-session S20c`

## Decisions in effect for the next step
- D20: private events by link; round robin up to 8, Swiss above; sides set by pairing (0007, provisional default).
- D19: Claude's presets and grace time (provisional); see `rules/timeControls.json`.
- D18: no individual games published by the site (0007).

## Open questions for the owner
- D20 tournament format: Claude uses the 0007 defaults if unanswered. D16, D17, minimum age: S19c, S19d, S20d stay blocked.
- Before the first deploy: create D1 `apexchess-archive` and send Claude its id; apply migrations 0001 to 0003.

## Notes for Claude
- Clock logic: `packages/online/src/clock.ts` (pure); `room.ts` `tick`, `deadline`, `presence` take `now`.
- App reads `window.location.hash` once at start (guarded for server render in tests).
- Never `pkill -f wrangler`; use `pkill -f "[w]rangler"`.

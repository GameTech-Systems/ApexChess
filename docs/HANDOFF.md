# Handoff

Updated 2026-10-21 by S12 (Sonnet 5.5 · medium). `/end-session` rewrites this file; keep it under 30 lines.

## State
- Phase 2. Engine complete for hot-seat play; web app now opens on a setup builder for each player (D14), then the game.
- Web: `SetupBuilder.tsx` (tap to place or move, Remove, Clear, live `checkSetup` errors, presets from official catalog setups, save/load/delete on the device via `savedSetups.ts`). `seats.ts` alternates sides on rematch (D15). Engine gained `setupArea`.

## Next session
**S13 — Computer opponent** · Opus 5.5 · effort high
Set: `/model opus` · `/effort high`
Why: Search and evaluation design needs correctness care.
Start with: `/start-session S13`

## Decisions in effect for the next step
- D8: draws automatic (decided)

## Open questions for the owner
- None blocking S13. `standard` ruleset is still draft 0.1.0; make it official 1.0.0 when approved.
- Setup code letters and format are provisional (notation, not a rule).

## Notes for Claude
- Builder is tap-only (no drag yet); only the `default` preset exists, more need owner-supplied data.
- Builder screen has no dark-square color picker; it lives in the game screen.
- Web tests are SSR and pure-function only (no jsdom); UI click flows are untested.
- `positionKey` runs full legal-move generation; avoid brute-force searches over long replays.
- `pnpm lint` includes `prettier --check`; run `pnpm exec prettier --write .` first.

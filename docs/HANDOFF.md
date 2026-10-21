# Handoff

Updated 2026-10-21 by S14 (Sonnet 5.5 · medium). `/end-session` rewrites this file; keep it under 30 lines.

## State
- Phase 2. Hot-seat and vs-computer play work, with play aids: show-legal-moves, pieces-in-danger (attacked and undefended), undo (also takes back the computer's reply), sound toggle, last-move and check marks, a Rules screen with The Elbow Room note, and a phone layout (CSS media query).
- Helpers in `apps/web/src/playAids.ts`; rules text in `Rules.tsx`.

## Next session
**S15 — Self-play harness and setup statistics** · Opus 5.5 · effort high
Set: `/model opus` · `/effort high`
Why: Correctness-critical statistics on the existing search AI.
Start with: `/start-session S15`

## Decisions in effect for the next step
- None named for S15.

## Open questions for the owner
- None blocking S15. `standard` ruleset is still draft 0.1.0; make it official 1.0.0 when approved.
- Setup code letters and format are provisional (notation, not a rule).

## Notes for Claude
- Undo is for local play only; online play (later) must not offer it.
- Sound uses Web Audio beeps (no assets); capture sound is detected by piece count < 32.
- AI piece values = mean empty-board reach; search runs on the main thread (Hard ≈1 s worst case).
- Web tests are SSR and pure-function only (no jsdom); UI click flows are untested.
- `pnpm lint` includes `prettier --check`; run `pnpm exec prettier --write .` first.

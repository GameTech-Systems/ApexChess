# Handoff

Updated 2026-10-21 by S13 (Opus 5.5 · high). `/end-session` rewrites this file; keep it under 30 lines.

## State
- Phase 2. Hot-seat and vs-computer play work. App opens on a choice: Two players or Play the computer (level: Random, Easy, Medium, Hard).
- Engine `ai.ts`: `seededRandom`, `randomMove`, `chooseSetup` (random legal preset), `pieceValues`/`evaluate` derived from movement data, `bestMove` (iterative-deepening alpha-beta, quiescence, node cap).

## Next session
**S14 — Play aids, rules screen, mobile layout** · Sonnet 5.5 · effort medium
Set: `/model sonnet` · `/effort medium`
Why: Settled UI work on the existing engine and app.
Start with: `/start-session S14`

## Decisions in effect for the next step
- D9: keep "files and ranks" (decided)

## Open questions for the owner
- None blocking S14. `standard` ruleset is still draft 0.1.0; make it official 1.0.0 when approved.
- Setup code letters and format are provisional (notation, not a rule).

## Notes for Claude
- AI piece values = mean empty-board reach; centralization and promotion weights are provisional heuristics (`ai.ts`).
- Search runs on the main thread (Hard ≈1 s worst case); a Web Worker is a possible follow-up.
- Search treats a position's first recurrence as a draw; its key ignores legal moves (cheaper than `positionKey`).
- Web tests are SSR and pure-function only (no jsdom); UI click flows, incl. computer turns, are untested.
- `pnpm lint` includes `prettier --check`; run `pnpm exec prettier --write .` first.

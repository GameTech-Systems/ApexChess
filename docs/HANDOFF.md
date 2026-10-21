# Handoff

Updated 2026-10-21 by the draw-claim change (Sonnet 5.5). `/end-session` rewrites this file; keep it under 30 lines.

## State
- Phase 1. Rules data in `rules/` (parameters, board, pieces, default setup, `standard` ruleset 0.1.0 draft) with schemas; resolver, setup checks.
- Engine: `generateMoves`, `attackedSquares`, `legalMoves`, `inCheck`, `makeMove`, and `newGame`/`play`/`result` (checkmate; stalemate, threefold, fifty-move, insufficient material draws). Format: `docs/decisions/0002-rules-data.md`.

## Next session
**S9 — Diamond board renderer** · Sonnet 5.5 · effort medium
Set: `/model sonnet` · `/effort medium`
Why: rendering from settled board data; no rule design.
Start with: `/start-session S9`

## Decisions in effect for the next step
- D4: light's king on h1, dark's on a8; each player sees their own king at the bottom (decided)

## Open questions for the owner
- None blocking S9. Claim vs auto draws done (owner 2026-10-21); UI for claiming and the auto toggle belongs to S10.
- `standard` ruleset is still draft 0.1.0; make it official 1.0.0 when the owner approves.

## Notes for Claude
- Royal piece and move-rule reset come from piece flags `royal`, `resetsMoveRule`; draw data lives in the ruleset's `draws`.
- Owner (2026-10-21): attacks give check even under `firstMoveCaptures: forbidden`; it cannot arise in `standard` since chords 0 to 4 are full.
- Fixtures: `packages/engine/test/fixtures/legal.json` (check, mate, stalemate, material) and `moves.json`.
- `pnpm lint` includes `prettier --check`; run `pnpm exec prettier --write .` before committing.

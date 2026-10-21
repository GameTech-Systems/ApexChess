# Handoff

Updated 2026-10-21 by S7 (Opus 5.5 · high). `/end-session` rewrites this file; keep it under 30 lines.

## State
- Phase 1. Rules data in `rules/` (parameters, board, pieces, default setup, `standard` ruleset 0.1.0 draft) with schemas; resolver, setup checks.
- Engine: `generateMoves` gives pseudo-legal moves from `rules/pieces/standard.json` (steps for light, mirrored; `onFarEdge`, `firstMove`, `when`); `startPosition`, `moveText`. Format: `docs/decisions/0002-rules-data.md`.

## Next session
**S8 — Check, checkmate, and draws** · Opus 5.5 · effort high
Set: `/model opus` · `/effort high`
Why: attack maps, legality, and draw rules need careful design.
Start with: `/start-session S8`

## Decisions in effect for the next step
- D8: stalemate, threefold, fifty-move, insufficient material, agreement are draws (decided)
- D7: no first-move captures option is applied in `generateMoves` on plies 0 and 1 (decided)

## Open questions for the owner
- None blocking S8. Under `firstMoveCaptures: forbidden`, does a piece still give check on ply 0/1? Default: yes, attacks count.

## Notes for Claude
- Build attack maps from the same movement data (capture-capable entries); `generateMoves` has no make/unmake yet.
- `Position` tracks `ply` and `unmoved`; no en passant state by design.
- Move fixtures: `packages/engine/test/fixtures/moves.json` (defaults ply 10, nothing unmoved).
- Ruleset `standard` stays draft 0.1.0; can go official 1.0.0 after S8.
- `pnpm lint` includes `prettier --check`; run `pnpm exec prettier --write .` before committing.

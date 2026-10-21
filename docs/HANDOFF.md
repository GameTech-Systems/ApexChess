# Handoff

Updated 2026-10-21 by S10 (Sonnet 5.5 · medium). `/end-session` rewrites this file; keep it under 30 lines.

## State
- Phase 1. Rules data, resolver, setup checks, move generation, legal moves, check, game end and draws in the engine.
- Engine `record.ts`: `GameRecord` keeps ruleset id and version, both setups, and moves; `replay`/`addMove`. Fixture `packages/engine/test/fixtures/sample-game.json` (22 plies, dark mates).
- Web: hot-seat game in `App.tsx` (select, highlights, promotion picker, result, rematch, move list). Board is black and white; dark-square color is a dropdown (`hotseat.ts`).

## Next session
**S11 — Setup validator and setup codes** · Sonnet 5.5 · effort high
Set: `/model sonnet` · `/effort high`
Why: constraint validation and canonical ids need careful correctness.
Start with: `/start-session S11`

## Decisions in effect for the next step
- D5: extra piece beyond front chord starts on the next chord only (decided)
- D6: same-color bishops allowed in Player's Choice (decided)

## Open questions for the owner
- None blocking S11. Black-and-white default with optional dark-square colors is from the owner's S10 message; the color list is provisional.
- `standard` ruleset is still draft 0.1.0; make it official 1.0.0 when approved.

## Notes for Claude
- Rematch only clears the board; D15 side alternation is not wired (hot-seat uses the default setup for both, so nothing differs yet). Wire it in S12.
- The board turns to the mover each move by default (checkbox off keeps the light seat).
- `positionKey` runs full legal-move generation, so long replays are slow: avoid brute-force searches.
- `pnpm lint` includes `prettier --check`; run `pnpm exec prettier --write .` first.

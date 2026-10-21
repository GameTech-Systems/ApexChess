# Handoff

Updated 2026-10-21 by S11 (Sonnet 5.5 · high). `/end-session` rewrites this file; keep it under 30 lines.

## State
- Phase 1. Rules data, resolver, setup checks, move generation, legal moves, check, game end and draws in the engine.
- Engine `setupcode.ts`: `encodeSetup`/`decodeSetup` (e.g. default `K/BR/RQB/PPPP/PPNPP/5N`), `mirrorSetup` (reflection across the h1 to a8 ray), `canonicalSetupId` (smaller of a setup's and its mirror's code). `checkSetup` (S6) is the validator; fixtures in `test/fixtures/setups.json`.
- Piece data gained a required `letter` (K Q R B N P) for codes; schema updated (pieces `standard` still draft 0.1.0).
- Web: hot-seat game in `App.tsx`; board is black and white with a dark-square color dropdown.

## Next session
**S12 — Setup builder, saved setups, presets** · Sonnet 5.5 · effort medium
Set: `/model sonnet` · `/effort medium`
Why: UI work on settled engine functions.
Start with: `/start-session S12`

## Decisions in effect for the next step
- D14: hot-seat players build setups while the other looks away; both revealed at the start (decided)
- D15: players alternate sides on rematch (decided)

## Open questions for the owner
- None blocking S12. `standard` ruleset is still draft 0.1.0; make it official 1.0.0 when approved.
- The setup code letters and format are provisional (notation, not a rule).

## Notes for Claude
- Rematch only clears the board; D15 side alternation is not wired. Wire it in S12.
- No legal setup is its own mirror (the beyond piece is never on the ray), so every family has two members.
- `positionKey` runs full legal-move generation, so avoid brute-force searches over long replays.
- `pnpm lint` includes `prettier --check`; run `pnpm exec prettier --write .` first.

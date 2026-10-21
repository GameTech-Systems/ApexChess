# Handoff

Updated 2026-10-21 by S6 (Opus 5.5 · high). `/end-session` rewrites this file; keep it under 30 lines.

## State
- Phase 1. Rules data in `rules/` (parameters registry, `boards/standard`, `setups/default`, `rulesets/standard` 0.1.0 draft) with schemas; `validate:rules` also checks top-level `rules/<kind>.json`.
- Engine: `resolveRuleset` (refuses null/unknown parameters), `chordOf`, `placeSetup` (mirror for dark), `checkSetup` (corner, army, region, beyond). Format notes: `docs/decisions/0002-rules-data.md`.

## Next session
**S7 — Move generator with Apex pawns** · Opus 5.5 · effort high
Set: `/model opus` · `/effort high`
Why: movement data format and Apex pawn cases are design-heavy.
Start with: `/start-session S7`

## Decisions in effect for the next step
- D1: ray step, edge-sharing captures (decided)
- D2: far-edge square is move and capture (decided)
- D3: one square; option `pawnFirstMove: two` (decided)
- D7: first-move captures allowed; option `firstMoveCaptures: forbidden` (decided)

## Open questions for the owner
- None blocking S7.

## Notes for Claude
- Add each new rules file to `packages/engine/src/catalog.ts`; setups are written for light.
- Ruleset `standard` is `draft` 0.1.0; S7 adds movement data, then it can go official 1.0.0.
- Setup fixtures: `packages/engine/test/fixtures/setups.json` (changes applied to the default).
- `pnpm lint` includes `prettier --check`; run `pnpm exec prettier --write .` before committing.

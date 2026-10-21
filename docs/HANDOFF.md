# Handoff

Updated 2026-10-21 by S9 (Sonnet 5.5 · medium). `/end-session` rewrites this file; keep it under 30 lines.

## State
- Phase 1. Rules data in `rules/`, resolver, setup checks; engine has move generation, legal moves, check, game end and draws (`docs/decisions/0002-rules-data.md`).
- Web: `apps/web/src/Board.tsx` renders the SVG diamond board for either seat; geometry in `boardLayout.ts` (from board `forward` data); `App.tsx` shows the default setup with a seat toggle.

## Next session
**S10 — Hot-seat game with the default setup** · Sonnet 5.5 · effort medium
Set: `/model sonnet` · `/effort medium`
Why: game loop on settled engine and renderer; no rule design.
Start with: `/start-session S10`

## Decisions in effect for the next step
- D14: hot-seat setups are hidden until both are built (decided; S10 uses the default for both)
- D15: players alternate sides on rematch (decided)

## Open questions for the owner
- None blocking S10. Draws by repetition and the fifty-move rule are automatic (provisional).
- `standard` ruleset is still draft 0.1.0; make it official 1.0.0 when approved.

## Notes for Claude
- `Board` takes `onSquareClick(square)`; squares are `<g data-square>`, pieces `data-piece`. No highlight props yet: add for legal moves in S10.
- Square color is parity-derived (light corner = light) since board data has no colors; piece letters are placeholders.
- Renderer tests use `renderToStaticMarkup` (no jsdom). Tap target is the ~44px-diagonal square at 360px width.
- `pnpm lint` includes `prettier --check`; run `pnpm exec prettier --write .` first.

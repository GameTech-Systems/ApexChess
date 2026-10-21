# Handoff

Updated 2026-10-21 by S15 (Opus 5.5 · high). `/end-session` rewrites this file; keep it under 30 lines.

## State
- Phase 3 done. Hot-seat and vs-computer play with play aids; `packages/sim` runs bot self-play (`pnpm sim`) and writes a report by first move, setup family, and setup feature.
- Measures and thresholds: `docs/decisions/0003-self-play-measures.md` (provisional). First run: `docs/sim/S15-first-run.md` (640 games, light scores 54.5%, z 2.42).

## Next session
**S16 — Deploy** · Sonnet 5.5 · effort medium
Set: `/model sonnet` · `/effort medium`
Why: Plan default; deployment is mechanical once hosting is confirmed.
Start with: `/start-session S16`

## Decisions in effect for the next step
- D11: Cloudflare Workers with Static Assets; confirm terms at signup (default).

## Open questions for the owner
- None blocking S16. `standard` ruleset is still draft 0.1.0; make it official 1.0.0 when approved.
- Self-play thresholds (0003) are provisional; feature rows rest on 1 to 3 pool families, so a larger pool would separate features from setups.

## Notes for Claude
- Undo is for local play only; online play (later) must not offer it.
- `pnpm sim` runs under vite-node with one child process per core; game _i_ uses seed `seed + i`, so results don't depend on `--jobs`. 640 games take about 10 min on 4 cores.
- Game records go to `sim-out/` (gitignored); only the Markdown report is committed.
- Web tests are SSR and pure-function only (no jsdom); UI click flows are untested.
- `pnpm lint` includes `prettier --check`; run `pnpm exec prettier --write .` first.

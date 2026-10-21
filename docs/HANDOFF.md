# Handoff

Updated 2026-10-21 by S5 (Sonnet 5.5 · medium). `/end-session` rewrites this file; keep it under 30 lines.

## State
- Phase 1. pnpm workspace is in: `packages/engine` (stub), `apps/web` (blank Vite + React shell), root Vitest, ESLint, Prettier, strict `tsconfig.base.json`.
- `validate:rules` (Ajv) checks `rules/<kind>/**/*.json` against `rules/schema/<kind>.schema.json`; passes while `rules/` is empty. Commands are in CLAUDE.md.
- Issue labels created (`rule-proposal`, `setup-report`, `balance-report`, `playtest`; `bug` existed).

## Next session
**S6 — Rules data: board, setups, rulesets** · Opus 5.5 · effort high
Set: `/model opus` · `/effort high`
Why: first rules data and schemas; design-heavy and rule-sensitive.
Start with: `/start-session S6`

## Decisions in effect for the next step
- D4: light king on h1, dark on a8 (default)
- D5: extra piece beyond front chord on the next chord only (default)
- D6: same-color bishops allowed in Player's Choice (default)

## Open questions for the owner
- D1 to D9 are still defaults (S4 not done); S6 marks them provisional.

## Notes for Claude
- `.github/workflows/` can't be changed by a zip upload; ship workflow edits in a normal PR.
- `scripts/claude/ship.sh` uses `gh api` (REST), because `gh pr` fails in cloud sessions.
- Add each new `rules/<kind>/` folder together with `rules/schema/<kind>.schema.json`, or validation fails.
- `pnpm lint` includes `prettier --check`; run `pnpm exec prettier --write .` before committing.

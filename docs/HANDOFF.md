# Handoff

Updated 2026-10-20 by S1 follow-up (Sonnet 5.5, chat · medium). `/end-session` rewrites this file; keep it under 30 lines.

## State
- Phase 0. Foundation files are in: license and notices, session system (CLAUDE.md, `/start-session`, `/end-session`, `scripts/claude/ship.sh`), CI and zip-unpack workflows, `main` ruleset file, rules draft (`docs/RULES.md`), build plan.
- No code yet. The `ci` job checks JSON, YAML, and shell syntax until `package.json` exists, then runs the pnpm checks.

## Next session
**S5 — Workspace, CI, and labels** · Sonnet 5.5 · effort medium
Set: `/model sonnet` · `/effort medium`
Why: scaffolding needs no rule answers; it can run as soon as S2 (GitHub settings) is done.
Start with: `/start-session S5`

## Decisions in effect for the next step
- D12: a separate engine in this repo, patterns copied from the owner's other game (default)

## Open questions for the owner
- D1 to D9 (rules reading) are needed by S6 to S8, not by S5. Defaults are in the build plan.

## Notes for Claude
- `.github/workflows/` can't be changed by a zip upload; ship workflow edits in a normal PR.
- `scripts/claude/ship.sh` uses `gh api` (REST), because `gh pr` fails in cloud sessions.

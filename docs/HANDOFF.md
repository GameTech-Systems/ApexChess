# Handoff

Updated 2026-11-20 by S27b (Sonnet 5.5 · high). `/end-session` rewrites this file; keep it under 30 lines.

## State
- Product complete through UI1; launch prep, S22 to S24, S26, S27, S27b done. Phase 8 plan: `docs/LAUNCH-PLAN.md`.
- S27b: `thinkMove` (`apps/web/src/computer.ts`) logs a worker failure, falls back after a tick at `FALLBACK_MAX_NODES` (5000), and logs a failed page search too. `scripts/tests/worker-bundle.test.ts` builds the app and runs the real built worker; `scripts/smoke.mjs` checks the worker file is served as JavaScript.
- S27: service worker (`scripts/write-sw.mjs`), offline-aware Home. No new dependency.

## Next session
**S28 — Outside review (recurring)** · Sonnet 5.5 · effort medium
Set: `/model sonnet` · `/effort medium`
Why: Review S27 and S27b (service worker, offline UI, worker fallback).
Start with: `/start-session S28`

## Decisions in effect for the next step
- D24: decided, both: web app first (done in S27), desktop download later (no step yet). D16: passkey + handle (decided). D17: Glicko-2 per ruleset id (default).

## Open questions for the owner
- After deploy: `www` redirect, domain route (S3), Search Console sitemap, share previews, CSP reports; check `/sw.js` is live and installable.
- D17 confirmation. Name check: a Steam game "Chess: Apex" is announced; a trademark search is advised. S25 live checks are yours.

## Notes for Claude
- The review script clips its diff at 32k characters, so it can miss new files; pass `--focus` and check by hand.
- Never `pkill -f wrangler`; use `pkill -f "[w]rangler"`. Outside review: `pnpm review:outside`; rename its output to `*-s28<x>.md` (last: `s28b`) so older reports are not overwritten.
- Search legality shortcut in `ai.ts` relies on attacks being rays that stop at the first piece.
- `worker-bundle.test.ts` runs `vite build` into a temp folder (about 3 s) and shims `self` for Node.

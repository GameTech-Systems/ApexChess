# Handoff

Updated 2026-11-20 by S27 (Sonnet 5.5 · high). `/end-session` rewrites this file; keep it under 30 lines.

## State
- Product complete through UI1; launch prep, S22 to S24, S26, S27 done. Phase 8 plan: `docs/LAUNCH-PLAN.md`.
- S27: `scripts/write-sw.mjs` + `scripts/sw.template.js` write `dist/sw.js` (precache of the build; pages network-first, files cache-first; `/api` and `/version.json` never cached). `apps/web/src/offline.ts` registers it (prod only) and `useOnline`; Home disables online play, tournaments, stats, leaderboards, account when offline. Smoke checks `/sw.js`. Checked in real Chromium offline.
- No new dependency. Manifest already existed (S25).

## Next session
**S28 — Outside review (recurring)** · Sonnet 5.5 · effort medium
Set: `/model sonnet` · `/effort medium`
Why: Next todo Code step; review S27 (service worker, offline UI).
Start with: `/start-session S28`

## Decisions in effect for the next step
- D24: offline play via service worker, hot-seat and computer only (default, provisional). D16: passkey + handle (decided). D17: Glicko-2 per ruleset id (default).

## Open questions for the owner
- D24 confirmation. After deploy: `www` redirect, domain route (S3), Search Console sitemap, share previews, CSP reports; check `/sw.js` is live and installable.
- D17 confirmation. Name check: a Steam game "Chess: Apex" is announced; a trademark search is advised. S25 live checks are yours.

## Notes for Claude
- Open worker findings (S28): `thinkMove` worker-error fallback freezes the page and logs nothing; no test loads the real built worker (add to `scripts/smoke.mjs`).
- The review script clips its diff at 32k characters, so it can miss new files; pass `--focus` and check by hand.
- Never `pkill -f wrangler`; use `pkill -f "[w]rangler"`. Outside review: `pnpm review:outside`; rename its output to `*-s28<x>.md` so older reports are not overwritten.
- Search legality shortcut in `ai.ts` relies on attacks being rays that stop at the first piece.

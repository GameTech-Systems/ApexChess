# Handoff

Updated 2026-11-20 by S28 (Sonnet 5.5 · medium). `/end-session` rewrites this file; keep it under 30 lines.

## State
- Product complete through UI1; launch prep and S22 (CI build, deploy secrets check, live smoke) done. Phase 8 plan: `docs/LAUNCH-PLAN.md`.
- S28 review done (`docs/reviews/2026-11-20-s28-triage.md`); `LAST` now 004264c. Two real findings, both in the worker path (see Notes).
- S23 done: quiescence searches every evasion in check, scores mate/stalemate first, checks draws, carries mate distance; search repetition uses the game's `positionKey` (now exported). Computer moves in a Web Worker (`apps/web/src/computer.worker.ts`), with an on-page fallback.
- Hard level now ~1.4 s a move (was ~0.75 s) at the same node cap; the page stays responsive (17 ms max frame gap measured).
- Contact address GameTypeBrand@gmail.com (keep the capitals) on Privacy, Terms, footer, security.txt, TRADEMARKS.

## Next session
**S24 — Beta labels, ruleset version, privacy retention** · Sonnet 5.5 · effort medium
Set: `/model sonnet` · `/effort medium`
Why: Next todo Code step; S28 review found nothing blocking.
Start with: `/start-session S24`

## Decisions in effect for the next step
- D16: passkey + handle, no email, age 13+ (decided). D17: Glicko-2 per ruleset id (default).
- D21 to D24: open, defaults in the plan.

## Open questions for the owner
- After deploy: `www` redirect, domain route (S3), Search Console sitemap, share previews, CSP reports.
- D17 confirmation, including the abandoned-game rule (default: as built). Leaderboard defaults (as built).
- Name check: a Steam game "Chess: Apex" (Netherlate Games) is announced; a trademark search is advised.

## Notes for Claude
- Ledger ids D16 and D17 differ from the plan's; new ledger ids start at D21.
- Review findings to fix: `thinkMove` worker-error fallback freezes the page and logs nothing; no test loads the real built worker (add to `scripts/smoke.mjs`).
- Never `pkill -f wrangler`; use `pkill -f "[w]rangler"`. Outside review: `pnpm review:outside`.
- Search legality shortcut in `ai.ts` relies on attacks being rays that stop at the first piece; revisit if movement data gains hoppers.

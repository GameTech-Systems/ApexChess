# Handoff

Updated 2026-11-20 by S24 (Sonnet 5.5 · medium). `/end-session` rewrites this file; keep it under 30 lines.

## State
- Product complete through UI1; launch prep, S22, S23, S24 done. Phase 8 plan: `docs/LAUNCH-PLAN.md`.
- S24: header Beta badge with ruleset id/version (`apps/web/src/beta.tsx`); Beta notes on leaderboards, events, rated quick match; Privacy states no end date for archived games and no longer says "cannot be linked back".
- Privacy changed, so the S28 outside review runs next (covers S24 and the two open worker findings).
- Contact address GameTypeBrand@gmail.com (keep the capitals) on Privacy, Terms, footer, security.txt, TRADEMARKS.

## Next session
**S28 — Outside review (recurring)** · Sonnet 5.5 · effort medium
Set: `/model sonnet` · `/effort medium`
Why: S24 changed privacy text; review before S26.
Start with: `/start-session S28`

## Decisions in effect for the next step
- D16: passkey + handle, no email, age 13+ (decided). D17: Glicko-2 per ruleset id (default).
- D21 to D23: defaults applied in S24 (provisional). D24: open, default in the plan.

## Open questions for the owner
- After deploy: `www` redirect, domain route (S3), Search Console sitemap, share previews, CSP reports.
- D17 confirmation, including the abandoned-game rule (default: as built). Leaderboard defaults (as built).
- Name check: a Steam game "Chess: Apex" (Netherlate Games) is announced; a trademark search is advised.

## Notes for Claude
- Ledger ids D16 and D17 differ from the plan's; new ledger ids start at D21.
- Review findings to fix: `thinkMove` worker-error fallback freezes the page and logs nothing; no test loads the real built worker (add to `scripts/smoke.mjs`).
- Never `pkill -f wrangler`; use `pkill -f "[w]rangler"`. Outside review: `pnpm review:outside`.
- Search legality shortcut in `ai.ts` relies on attacks being rays that stop at the first piece; revisit if movement data gains hoppers.

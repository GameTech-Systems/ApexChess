# Handoff

Updated 2026-11-20 by S26 (Sonnet 5.5 · medium). `/end-session` rewrites this file; keep it under 30 lines.

## State
- Product complete through UI1; launch prep, S22 to S24, S26 done, and the S28 review of S24 and S26 ran. Phase 8 plan: `docs/LAUNCH-PLAN.md`.
- S26: five static pages (`/how-to-play/`, `/rules/`, `/45-degree-chess/`, `/custom-setups/`, `/about/`) built from `docs/RULES.md` by `scripts/info-pages.mjs` during `pnpm build`; in the sitemap and live smoke test; footer links How to play and About.
- S28b triage: `docs/reviews/2026-11-20-s28b-triage.md`; nothing new to fix. `docs/reviews/LAST` advanced.
- Contact address GameTypeBrand@gmail.com (keep the capitals) on Privacy, Terms, footer, security.txt, TRADEMARKS.

## Next session
**S27 — Offline play** · Sonnet 5.5 · effort high
Set: `/model sonnet` · `/effort high`
Why: Next Code step; D24 default applies.
Start with: `/start-session S27`

## Decisions in effect for the next step
- D24: open; default installable web app with a service worker (provisional). D16: passkey + handle (decided). D17: Glicko-2 per ruleset id (default).

## Open questions for the owner
- After deploy: `www` redirect, domain route (S3), Search Console sitemap (now five more URLs), share previews, CSP reports.
- D17 confirmation. Name check: a Steam game "Chess: Apex" is announced; a trademark search is advised. S25 live checks are yours.

## Notes for Claude
- Open worker findings (S28): `thinkMove` worker-error fallback freezes the page and logs nothing; no test loads the real built worker (add to `scripts/smoke.mjs`).
- The review script clips its diff at 32k characters, so it can miss new files; pass `--focus` and check by hand.
- Never `pkill -f wrangler`; use `pkill -f "[w]rangler"`. Outside review: `pnpm review:outside`; rename its output to `*-s28<x>.md` so older reports are not overwritten.
- Search legality shortcut in `ai.ts` relies on attacks being rays that stop at the first piece.

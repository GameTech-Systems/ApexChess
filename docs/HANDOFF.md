# Handoff

Updated 2026-11-23 by S28 (audit 2 triage; Opus 5.5 · medium). `/end-session` rewrites this file; keep it under 30 lines.

## State
- Product complete through UI1; launch prep S22 to S24, S26, S27, S27b done. Phase 8 plan: `docs/LAUNCH-PLAN.md`.
- Audit 2 (ChatGPT, 2026-11-23) triaged: `docs/reviews/2026-11-23-audit2-triage.md`. Fixed here: Rules page shows the live ruleset version and status (D21); build writes `<page>/index.html` per address with its own tags; deploy reruns validate, lint, typecheck, test; rollback in `DEV-WORKFLOW.md`; engine property tests; README and launch-plan statuses.
- New steps S30 to S33 and D25 in `docs/BUILD-PLAN.md` and the ledger (I17 to I22).

## Next session
**S30 — Endpoint limits and abuse tests** · Sonnet 5.5 · effort high
Set: `/model sonnet` · `/effort high`
Why: I20, one /api limit for everything; must land before S29.
Start with: `/start-session S30`

## Decisions in effect for the next step
- D16: passkey + handle (decided). Limit values are provisional, in `wrangler.jsonc`.

## Open questions for the owner
- D21: publish ruleset 1.0 or stay on draft 0.1 for the beta. D25 (PGN tags) before S33. D17 confirmation.
- I22: Cloudflare alerts for Worker errors and 429 spikes; one D1 Time Travel restore drill (S25).
- After deploy: `www` redirect, Search Console sitemap, share previews per page, `/sw.js` installable. Trademark search ("Chess: Apex").

## Notes for Claude
- `packages/engine/src/properties.test.ts` takes about 25 s; lower `GAMES` before raising its timeout.
- Page files come from the `apex-page-files` plugin in `apps/web/vite.config.ts`; titles live in `apps/web/src/routes.ts`.
- Review script clips diffs at 32k characters; pass `--focus`. Never `pkill -f wrangler`; use `pkill -f "[w]rangler"`.
- Search legality shortcut in `ai.ts` relies on attacks being rays that stop at the first piece.

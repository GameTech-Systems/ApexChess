# Handoff

Updated 2026-11-23 by S31 (Sonnet 5.5 · medium). `/end-session` rewrites this file; keep it under 30 lines.

## State
- Product complete through UI1; launch prep S22 to S24, S26 to S28, S31 done. Phase 8 plan: `docs/LAUNCH-PLAN.md`.
- S31: `dist/rules/index.html` and `dist/about/index.html` hold the page text (`apps/web/src/prerender.tsx`, run from the `apex-page-files` plugin); the app replaces it on start. Rules and About take optional `onClose`/`onOpen`, so static output has no dead buttons. Smoke checks the rules text.
- Not done: S30 (still before S29), S32, S33.

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
- Page titles live in `apps/web/src/routes.ts`; only Rules and About are pre-rendered. Add a page by extending `prerender()`.
- Review script clips diffs at 32k characters; pass `--focus`. Never `pkill -f wrangler`; use `pkill -f "[w]rangler"`.

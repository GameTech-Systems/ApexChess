# Handoff

Updated 2026-11-23 by S28 (Sonnet 5.5 · medium). `/end-session` rewrites this file; keep it under 30 lines.

## State
- Product complete through UI1; launch prep S22 to S24, S26 to S28, S30, S31 done. Phase 8 plan: `docs/LAUNCH-PLAN.md`.
- S30: sign-up, passkey, recovery, and new room/event requests also count against their own per-address limits (`apps/server/src/limits.ts`; bindings `SIGNUP`, `PASSKEY`, `RECOVER`, `NEWROOM` in `wrangler.jsonc`, provisional). Account deletion now drops pending challenges. Abuse tests in `accounts.test.ts`, `room.test.ts`, `limits.test.ts`.
- S28 reviewed S30: no real findings (`docs/reviews/2026-11-23-s28d-triage.md`). S28 stays `todo` for reruns.
- Not done: S32, S33; S29 is the owner's.

## Next session
**S32 — Interactive rules tutorial** · Opus 5.5 · effort high
Set: `/model opus` · `/effort high`
Why: Design-heavy new UI; S28 review of S30 is clean.
Start with: `/start-session S32`
Tip: Opus; start in a fresh usage window.

## Decisions in effect for the next step
- D16: passkey + handle (decided). Limit values are provisional, in `wrangler.jsonc`.

## Open questions for the owner
- D21: publish ruleset 1.0 or stay on draft 0.1 for the beta. D25 (PGN tags) before S33. D17 confirmation.
- Recovery attempts are limited per address only, not per handle; a per-handle lockout would need a table. Default: leave as is.
- `handle_reports` rows are kept when the reported account is deleted (reports are others' data). Default: keep.
- I22: Cloudflare alerts for Worker errors and 429 spikes; one D1 Time Travel restore drill (S25).
- After deploy: `www` redirect, Search Console sitemap, share previews per page, `/sw.js` installable. Trademark search ("Chess: Apex").

## Notes for Claude
- Worker rate-limit bindings are not run by vitest; `limits.test.ts` uses fakes and checks `wrangler.jsonc` names, namespaces, and that each is tighter than `LIMITER`.
- `packages/engine/src/properties.test.ts` takes about 25 s; lower `GAMES` before raising its timeout.
- Review script clips diffs at 32k characters; pass `--focus`. Never `pkill -f wrangler`; use `pkill -f "[w]rangler"`.

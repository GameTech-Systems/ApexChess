# Handoff

Updated 2026-11-27 by S32 (Opus 5.5 · high). `/end-session` rewrites this file; keep it under 30 lines.

## State
- Phase 8 (launch prep). Product complete through UI1; S22 to S24, S26 to S28, S30 to S32 done. Plan: `docs/LAUNCH-PLAN.md`.
- S32: tutorial at `/tutorial/` (`apps/web/src/Tutorial.tsx`), linked from Home and Rules. Lessons, positions, and answers are data in `apps/web/src/lessons.json` (tied to ruleset `standard` 1.0.0); `tutorial.test.ts` checks every legal move against the answers, and check/mate answers against the engine. Ends with a Random-moves game on the default setup.
- S28 review of PR #48 (and now S32) not yet run: the last attempt had no NVIDIA or OpenRouter key (401). Rerun: `pnpm review:outside --since 9b664da`.
- Not done: S33; S25, S29 are the owner's.

## Next session
**S28 — Outside review (recurring)** · Sonnet 5.5 · effort medium
Set: `/model sonnet` · `/effort medium`
Why: Review of PR #48 and S32 is still pending.
Start with: `/start-session S28`

## Decisions in effect for the next step
- D21: ruleset `standard` 1.0.0 official (decided). D16: passkey + handle (decided).

## Open questions for the owner
- D25 (PGN tags) before S33. D17 confirmation. `CLA.md` is still an unreviewed draft.
- Recovery attempts limited per address only. Default: leave as is. `handle_reports` kept after account deletion. Default: keep.
- I22: Cloudflare alerts; one D1 Time Travel restore drill (S25). After deploy: `www` redirect, Search Console sitemap (now lists `/tutorial/`), share previews, `/sw.js` installable. Trademark search.

## Notes for Claude
- A new ruleset version makes `tutorial.test.ts` fail on purpose: review `lessons.json` text and positions, then bump its `ruleset`.
- `packages/engine/src/properties.test.ts` takes about 25 s. Review script clips diffs at 32k characters; pass `--focus`. Never `pkill -f wrangler`; use `pkill -f "[w]rangler"`.

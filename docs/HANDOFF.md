# Handoff

Updated 2026-11-20 by S28 (Sonnet 5.5 · medium). `/end-session` rewrites this file; keep it under 30 lines.

## State
- Product complete through UI1; launch prep S22 to S24, S26, S27, S27b done. Phase 8 plan: `docs/LAUNCH-PLAN.md`.
- S28 (third run) reviewed S27 and S27b: nothing real. Triage: `docs/reviews/2026-11-20-s28c-triage.md`. `docs/reviews/LAST` is now `35272d2`.
- No Code step is left `todo`. Remaining: S25 (live checks, owner), S29 (community launch, owner), S28 (recurring).

## Next session
**S28 — Outside review (recurring)** · Sonnet 5.5 · effort medium
Set: `/model sonnet` · `/effort medium`
Why: Run only after the next code change; owner steps S25 and S29 come first.
Start with: `/start-session S28`

## Decisions in effect for the next step
- D24: decided, both: web app first (done in S27), desktop download later (no step yet). D16: passkey + handle (decided). D17: Glicko-2 per ruleset id (default).

## Open questions for the owner
- After deploy: `www` redirect, domain route (S3), Search Console sitemap, share previews, CSP reports; check `/sw.js` is live and installable.
- D17 confirmation. Name check: a Steam game "Chess: Apex" is announced; a trademark search is advised. S25 live checks are yours.

## Notes for Claude
- The review script clips its diff at 32k characters, so it can miss new files; pass `--focus` and check by hand. If `LAST` is not a known commit (rebase merge), pass `--since <commit>`.
- Never `pkill -f wrangler`; use `pkill -f "[w]rangler"`. `pnpm review:outside` overwrites `docs/reviews/*-<model>.md`; rename its output to `*-s28<x>.md` at once (last: `s28c`).
- Search legality shortcut in `ai.ts` relies on attacks being rays that stop at the first piece.
- `worker-bundle.test.ts` runs `vite build` into a temp folder (about 3 s) and shims `self` for Node.

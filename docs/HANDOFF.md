# Handoff

Updated 2026-11-20 by S22 (Sonnet 5.5 · medium). `/end-session` rewrites this file; keep it under 30 lines.

## State
- Product complete through UI1: home, logo, setup builder, rules diagrams, legal pages and CSP (`_headers`).
- Launch prep: sitemap, robots, canonical/OG/Twitter tags, share card, icons, manifest, security.txt, README. Images: `scripts/brand-images.mjs`; share card approved by owner.
- S22 done: CI runs `pnpm build`; deploy fails on missing Cloudflare secrets, writes `/version.json` (commit), then runs `scripts/smoke.mjs` on the live site. Before the first deploy, the smoke commit check fails (no version.json live yet).
- Phases 0 to 7 done; S17 testers in progress. Phase 8 (launch, S22 to S29) planned from the 2026-11-20 outside audit: `docs/LAUNCH-PLAN.md`.
- Contact address GameTypeBrand@gmail.com (keep the capitals) on Privacy, Terms, footer, security.txt, TRADEMARKS.
- Outside review: `pnpm review:outside` (NVIDIA build API, key from the cloud proxy); S28 runs after each major update.

## Next session
**S23 — AI search horizon** · Opus 5.5 · high
Set: `/model opus` · `/effort high`
Why: next Phase 8 step in plan order.
Start with: `/start-session S23`

## Decisions in effect
- D16: passkey + handle, no email, age 13+ (decided). D17: Glicko-2 per ruleset id, "?" while RD > 110 (default).
- Leaderboards: opt-in per account, settled ratings only, top 50 (default, 0006).
- D21 to D24 (beta label, Beta-marked rated features, archive retention, offline as a web app): open, defaults in the plan.

## Open questions for the owner
- After deploy: `www` redirect, domain route (S3), Search Console sitemap, share previews, CSP reports.
- D17 confirmation, including the abandoned-game rule (default: as built). Leaderboard defaults (as built).
- Name check: a Steam game "Chess: Apex" (Netherlate Games) is announced; a trademark search is advised.

## Notes for Claude
- Ledger decision ids D16 and D17 differ from the plan's; new ledger ids start at D21.
- Never `pkill -f wrangler`; use `pkill -f "[w]rangler"`.

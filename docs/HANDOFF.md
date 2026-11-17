# Handoff

Updated 2026-10-24 by UI1 (Opus 5.5 chat · high). `/end-session` rewrites this file; keep it under 30 lines.

## State
- UI1 (owner brief): home page "Chess Shifted" (`Home.tsx`), turned-board logo (`Logo.tsx`, favicon), Home link on every page, footer with legal links.
- Home offers the default setup or a custom one for every opponent; `Online` takes a chosen `setup`.
- Setup builder: fixed king, chord-beyond callout, swaps, seat-correct view.
- Rules screen: every piece's moves with engine-drawn diagrams (`pieceDiagrams.ts`). Move list pairs turns (`MoveList.tsx`).
- Legal: `third-party-licenses.txt` in dist, NOTICE, `_headers` (CSP), Terms names/logo and liability lines (provisional).
- Launch prep: sitemap, robots, canonical/OG/Twitter tags, share card, icons, manifest, security.txt, README. Images: `scripts/brand-images.mjs` (logo + text only).
- Phase 7 and every Code step in `docs/BUILD-PLAN.md` are done. Owner steps S2, S3, S17 remain; the site is not live yet.

## Next session
**None planned** · Owner steps next (S3 hosting, then deploy)
Set: owner's choice when new steps are added to `docs/BUILD-PLAN.md`
Why: every Code step is done.
Start with: `/start-session <new step>`

## Decisions in effect
- D16: passkey + handle, no email; minimum age 13 (decided).
- D17: Glicko-2, one pool per ruleset id, "?" while RD > 110 (default).
- Leaderboards: opt-in per account, settled ratings only, top 50 (default, 0006).

## Open questions for the owner
- Approve the share card (`apps/web/public/og-image.png`). After deploy: `www` to apex redirect, domain route in `wrangler.jsonc` (S3), submit sitemap in Search Console, check share previews.
- D17 confirmation, including the abandoned-game rule (default: as built). Leaderboard defaults (as built).
- Privacy and Terms need a contact address before launch (TRADEMARKS.md says the same).
- Name check: a Steam game "Chess: Apex" (Netherlate Games) is announced; a trademark search is advised.
- After the first deploy, check the browser console for CSP reports (`apps/web/public/_headers`).

## Notes for Claude
- Never `pkill -f wrangler`; use `pkill -f "[w]rangler"`.

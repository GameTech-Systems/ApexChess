# Handoff

Updated 2026-11-27 by S34 (Sonnet 5.5 · medium). `/end-session` rewrites this file; keep it under 30 lines.

## State
- Phase 8 (launch prep). Product complete through UI1; S22 to S24, S26 to S28, S30 to S34 done. Plan: `docs/LAUNCH-PLAN.md`.
- S34: PGN import UI (D26). Home "More" has "Open a PGN game" (`PgnImport.tsx`): file picker or paste, opens `Replay` through `importPgn` / `openPgnFile` in `share.ts` (reads under the ruleset version the PGN names; cap `PGN_MAX_CHARS` 200k; errors in plain words). Replay only: no play-on, nothing saved or uploaded; works offline.
- S33 PGN export (`packages/engine/src/pgn.ts`, tags per D25 default, provisional). S32 tutorial at `/tutorial/`.
- Not done: S25, S29 are the owner's. Web only changed this session, so no S28 review is due.

## Next session
No Code step is left. S25 and S29 are the owner's; run `/start-session S28` after the next engine, server, or privacy change.
Set: `/model sonnet` · `/effort medium`

## Decisions in effect for the next step
- D21: ruleset `standard` 1.0.0 official (decided). D16: passkey + handle (decided).

## Open questions for the owner
- D26 (PGN import): replay only, 200 KB cap; want "play on from here" or import on the Replay page too? Default: leave as is.
- D25 (PGN tags): confirm names or change them. D17 confirmation. `CLA.md` is still an unreviewed draft.
- Recovery attempts limited per address only. Default: leave as is. `handle_reports` kept after account deletion. Default: keep.
- Not changed: CSP exists; HSTS preload/`includeSubDomains` is the owner's call.
- I22: Cloudflare alerts; one D1 Time Travel restore drill (S25). After deploy: `www` redirect, Search Console sitemap, share previews, `/sw.js` installable. Trademark search.

## Notes for Claude
- A new ruleset version makes `tutorial.test.ts` fail on purpose: review `lessons.json` text and positions, then bump its `ruleset`.
- `packages/engine/src/properties.test.ts` takes about 25 s. Review script clips diffs at 32k characters; pass `--focus`. Never `pkill -f wrangler`; use `pkill -f "[w]rangler"`.
- Web tests use `renderToStaticMarkup` (no DOM); keep UI logic in pure functions like `importPgn`.

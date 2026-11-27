# Handoff

Updated 2026-11-27 by S33 (Sonnet 5.5 · medium). `/end-session` rewrites this file; keep it under 30 lines.

## State
- Phase 8 (launch prep). Product complete through UI1; S22 to S24, S26 to S28, S30 to S33 done. Plan: `docs/LAUNCH-PLAN.md`.
- S33: PGN export. `packages/engine/src/pgn.ts` (`toPgn`, `parsePgn`, `parsePgnFromCatalog`); "Download PGN" button in hot-seat (`App.tsx`) and online (`Online.tsx`) games via `downloadPgn` in `share.ts`. Tags per D25 default (provisional): `Variant`, `Ruleset`, `LightSetup`, `DarkSetup`, `Result`. Moves use the record's own text (`e2-e4`), not SAN. Import is parse-only; no UI yet.
- S32 tutorial at `/tutorial/` (`apps/web/src/Tutorial.tsx`, data in `lessons.json`).
- Not done: S28 (next, review of S33); S25, S29 are the owner's.

## Next session
**S28 — Outside review** · Sonnet 5.5 · effort medium
Set: `/model sonnet` · `/effort medium`
Why: S33 added an engine module; review it, then launch steps are the owner's.
Start with: `/start-session S28 --focus packages/engine/src/pgn.ts`

## Decisions in effect for the next step
- D21: ruleset `standard` 1.0.0 official (decided). D16: passkey + handle (decided).

## Open questions for the owner
- D25 (PGN tags): S33 used the default; confirm names or change them. PGN import UI wanted? D17 confirmation. `CLA.md` is still an unreviewed draft.
- Recovery attempts limited per address only. Default: leave as is. `handle_reports` kept after account deletion. Default: keep.
- Not changed: CSP exists; HSTS preload/`includeSubDomains` is the owner's call.
- I22: Cloudflare alerts; one D1 Time Travel restore drill (S25). After deploy: `www` redirect, Search Console sitemap (now lists `/tutorial/`), share previews, `/sw.js` installable. Trademark search.

## Notes for Claude
- A new ruleset version makes `tutorial.test.ts` fail on purpose: review `lessons.json` text and positions, then bump its `ruleset`.
- `packages/engine/src/properties.test.ts` takes about 25 s. Review script clips diffs at 32k characters; pass `--focus`. Never `pkill -f wrangler`; use `pkill -f "[w]rangler"`.

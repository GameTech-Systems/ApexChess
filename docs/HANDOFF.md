# Handoff

Updated 2026-10-22 by S19c (Opus 5.5 · high). `/end-session` rewrites this file; keep it under 30 lines.

## State
- Phase 6. Optional accounts (D16 decided): passkey + handle, no email, 13+ via Terms checkbox; 8 recovery codes; sign-out, delete, handle reports. Account and Terms pages; Privacy text updated.
- Handle policy (provisional) now also governs event names: 3 to 20 ASCII letters, digits, _ and -.
- Checked end to end in `wrangler dev` + Chromium virtual authenticator (sign up, sign in, recover, delete).
- Not live: S16 hosting steps plus the D1 database (0004) are still open.

## Next session
**S19d — Phase 6: Ratings** · Opus 5.5 · effort high
Set: `/model opus` · `/effort high`
Why: blocked until the owner confirms D17 and an abandoned-game rule.
Start with: `/start-session S19d`

## Decisions in effect for the next step
- D16: passkey + handle, no email; minimum age 13 (decided).
- D17: Glicko-2, one pool per ruleset id, signed-in quick match only (0006, default).

## Open questions for the owner
- D17 ratings and the abandoned-game rule (default: unfinished rated games are never scored).
- Before the first deploy: create D1 `apexchess-archive`, send Claude its id, apply migrations 0001 to 0004.

## Notes for Claude
- Accounts: `apps/server/src/accounts.ts` (tests use node:sqlite), routes in `routes.ts`, web `apps/web/src/{account.ts,Account.tsx}`.
- Games are not linked to accounts yet; S19d adds a separate link table that account deletion must also clear.
- Never `pkill -f wrangler`; use `pkill -f "[w]rangler"`.

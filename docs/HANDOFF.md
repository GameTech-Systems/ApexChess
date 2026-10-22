# Handoff

Updated 2026-10-22 by S20c (Opus 5.5 · high). `/end-session` rewrites this file; keep it under 30 lines.

## State
- Phase 7. Private events by link (D20 default): `#event=CODE` page, display names per event, round robin up to 8 / Swiss above, byes, Sonneborn-Berger / Buchholz, crosstable, `noindex`, deletion 7 days after the last game.
- Each board is an event room: sides by pairing, each player locks a setup; no lock by the starting time loses on time (both: 0–0). Clocked controls only.
- Not live: S16 hosting steps plus the D1 database (see 0004) are still open. Every remaining Code step is blocked on owner decisions.

## Next session
**S19c — Phase 6: Accounts** · Opus 5.5 · effort high
Set: `/model opus` · `/effort high`
Why: blocked until the owner decides D16 and the minimum age.
Start with: `/start-session S19c`

## Decisions in effect for the next step
- D16: passkey + handle, no email (0006, default; owner must confirm before S19c).
- D20: S20c choices listed in 0007 "S20c implementation" (provisional).

## Open questions for the owner
- D16 and minimum age (S19c); D17 (S19d). S20d waits on both.
- D20: confirm or change the S20c choices in 0007 (clocked controls only, no-show rule, name policy).
- Before the first deploy: create D1 `apexchess-archive` and send Claude its id; apply migrations 0001 to 0003. Deploy adds Durable Object migration v2 (`Tournament`).

## Notes for Claude
- Event logic: `packages/online/src/{pairing,standings,names,event}.ts` (pure); server `Tournament` DO in `apps/server/src/worker.ts`; rooms report results with retry.
- S19c should replace `names.ts` policy with the handle policy and add the report path.
- Never `pkill -f wrangler`; use `pkill -f "[w]rangler"`.

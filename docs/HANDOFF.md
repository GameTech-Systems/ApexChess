# Handoff

Updated 2026-10-22 by S18 (Opus 5.5 · high). `/end-session` rewrites this file; keep it under 30 lines.

## State
- Phase 5 done. Online play: `packages/online` (protocol, room rules, quick-match queue, `follow`), `apps/server` (Worker, `Room` and `Lobby` Durable Objects), web `Online.tsx` (lock setup, quick match or private room code, reconnect, resign, draw offers, rematch). Checked end to end on `wrangler dev` in a real browser.
- Not live yet: the S16 owner hosting steps are still open. Deploying now also creates the Durable Objects (migration `v1`).

## Next session
**S19 — Accounts, ratings, and public setup statistics** · Opus 5.5 · effort high
Set: `/model opus` · `/effort high`
Why: Accounts and stored data need careful design and privacy review; plan section is still empty.
Start with: `/start-session S19`

## Decisions in effect for the next step
- D13: setup locked before matchmaking; server reveals both, then flips the coin (decided).
- D15: rematch needs both players; sides switch (decided).
- D11: Cloudflare Workers + Durable Objects (provisional). Room retention 7 days, no forfeit for disconnects (provisional, 0005).

## Open questions for the owner
- S19 has no scope in the plan: which sign-in (or none), what ratings, what stats go public. Default: plan only, no accounts code.
- Disconnects: no clock or abandonment rule online. Default: game waits.
- Hosting steps from S16 (Cloudflare account, two secrets, domain); S17 testers wait on them.
- `standard` ruleset still draft 0.1.0; thresholds in 0003 provisional.

## Notes for Claude
- `pnpm dev:server` runs `wrangler dev` on 8787; `pnpm dev` proxies `/api`. Never `pkill -f wrangler` (kills your own shell); use `pkill -f "[w]rangler"`.
- Full replays are slow (~0.6 s for 200 plies); use `follow()` for incremental game state.
- No rate limiting on `/api` yet. Web tests are SSR and pure-function only.
- `pnpm lint` includes `prettier --check`; run `pnpm exec prettier --write .` first.

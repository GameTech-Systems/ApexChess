# Handoff

Updated 2026-10-21 by S16 (Sonnet 5.5 · medium). `/end-session` rewrites this file; keep it under 30 lines.

## State
- Phase 3 done; S16 repo work done: `wrangler.jsonc` (Workers Static Assets, SPA fallback), `.github/workflows/deploy.yml` (deploys on push to `main` once secrets exist), in-app Privacy page, error boundary, `index.html` load-failure fallback and noscript.
- Not live yet: the owner must finish hosting setup (see questions). Details: `docs/decisions/0004-hosting.md`.

## Next session
**S18 — Online play with hidden setups** · Opus 5.5 · effort high
Set: `/model opus` · `/effort high`
Why: Server design, hidden-setup protocol, and reconnection need careful reasoning.
Start with: `/start-session S18`

## Decisions in effect for the next step
- D13: each player locks a saved setup before matchmaking; the server reveals both at the start, then flips the coin (decided).
- D11: Cloudflare Workers; server pieces likely Durable Objects (provisional).

## Open questions for the owner
- Owner steps for S16 to go live: create the Cloudflare account, add repo secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`, attach apexchess.icu to the `apexchess` Worker. S18 can proceed without them.
- S17 (outside testers) is an Owner step and waits on the deploy.
- `standard` ruleset is still draft 0.1.0; make it official 1.0.0 when approved.
- Self-play thresholds (0003) are provisional.

## Notes for Claude
- Undo is for local play only; online play must not offer it.
- The Privacy page says no accounts and no server storage; update it when online play or accounts add data.
- Web tests are SSR and pure-function only (no jsdom).
- `pnpm lint` includes `prettier --check`; run `pnpm exec prettier --write .` first.
- `pnpm sim` game records go to `sim-out/` (gitignored).

# Apex Chess

A chess variant played with the standard pieces on a standard board turned 45°, so each player's king starts in its own light corner. Players can bring their own starting arrangement, and rules ship as data so new setups and rule sets are easy to add.

Play at **[apexchess.icu](https://apexchess.icu)**. This repository holds the game's code, rules text, and rule data.

## Ways to play

- **Against the computer**, at a strength you pick.
- **Two players, one screen**, passing the device between moves.
- **Online**, by quick match or a private room with a friend. Rated play is for signed-in accounts; accounts are optional and use a passkey and a handle (no email).
- **Events**: private tournaments by link (round robin or Swiss), with clocks.
- Every game can start from the default setup or from your own arrangement, and finished games can be shared as a replay link.

## The game in brief

- **The board** is an ordinary 8×8 board turned 45°. Light's king starts on h1 and dark's on a8, the two light corners.
- **Chords and rays.** A chord is a side-to-side line across the turned board; a ray runs forward and back. Bishops travel along chords and rays; rooks travel along files and ranks, which run on the slant.
- **Pawns** step forward along their ray toward the opposing king's corner, capture one square forward and to the side, and promote only on the far light corner.
- **Player's Choice.** Arrange your own pieces under two rules: your king starts in your light corner, and only one piece may start beyond your front chord (d1 to h5 for light, e8 to a4 for dark). Online, you see your opponent's arrangement only when the game begins, and a coin flip decides who plays light and moves first.
- No castling and no en passant.

The full rules, including the default setup, are in [docs/RULES.md](docs/RULES.md). They are a draft: items marked provisional follow a default that has not been confirmed yet.

## The Elbow Room

Any existing chess set can be used for live play in this octant style: turn the board 45° so each king sits on its light corner, then play with personalized setups and rules. For live games played with special or altered rules, keep a printout or a written copy of the rule set at the table.

## Development

Requires Node 22 and pnpm 10.

```bash
pnpm install
pnpm dev          # web app (proxies /api to port 8787)
pnpm dev:server   # online-play Worker via wrangler dev on 8787
pnpm test         # Vitest, all packages
pnpm lint         # ESLint + Prettier check
pnpm typecheck
pnpm validate:rules   # rules/<kind>/*.json against rules/schema
pnpm build
pnpm sim          # bot self-play report
```

| Path | What it is |
| --- | --- |
| `packages/engine` | Rules engine: moves, check, setups, records. Reads everything from `rules/`. |
| `packages/online` | Room, matchmaking, event, and clock logic shared by client and server. |
| `packages/sim` | Bot self-play for balance reports. |
| `apps/web` | Vite + React static app, including `public/` (robots, sitemap, share image, icons). |
| `apps/server` | Cloudflare Worker and Durable Objects for online play, D1 for the archive and accounts. |
| `rules/` | Pieces, boards, setups, rulesets, parameters, time controls, and their JSON schemas. |
| `docs/` | Rules in words, build plan, decisions, and the current handoff. |

Rules and setups are data: a new setup or rule set is a JSON file validated against its schema, not a code change. Official rulesets are immutable; changes ship as a new version.

## Deployment

The static app and the Worker deploy together to Cloudflare with `wrangler deploy` (`wrangler.jsonc`); `.github/workflows/deploy.yml` does it on every push to `main`. It fails (it does not skip) when `CLOUDFLARE_API_TOKEN` or `CLOUDFLARE_ACCOUNT_ID` is missing, and afterwards runs `scripts/smoke.mjs` against the live site (home page, API, room create and join, WebSocket, and the deployed commit from `/version.json`). CI runs `pnpm build` on every pull request. Security headers and cache rules for the static files are in `apps/web/public/_headers`. See [docs/DEV-WORKFLOW.md](docs/DEV-WORKFLOW.md) for repository settings and [docs/decisions/0004-hosting.md](docs/decisions/0004-hosting.md) for the hosting choice.

## Status

Feature-complete for launch: the game, computer opponent, online play, accounts and ratings, public setup statistics, events, and leaderboards are built. The remaining steps are the owner's (hosting, domain, outside testers). The rules are still a draft: items marked provisional follow a default that has not been confirmed. Current state: [docs/HANDOFF.md](docs/HANDOFF.md); plan: [docs/BUILD-PLAN.md](docs/BUILD-PLAN.md).

## License

The code, rules text, and rule data are **source-available** under the [PolyForm Shield License 1.0.0](LICENSE). This is not an open source license. The name "Apex Chess", logos, art, and other brand assets are reserved; see [NOTICE](NOTICE) and [TRADEMARKS.md](TRADEMARKS.md).

## Contributing

Rule ideas, setup reports, and bug reports are welcome. Please read [CONTRIBUTING.md](CONTRIBUTING.md) and the [Code of Conduct](CODE_OF_CONDUCT.md) first.

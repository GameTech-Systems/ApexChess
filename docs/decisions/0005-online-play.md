# 0005: Online play

Date: 2026-10-22 · Status: D13 decided; server details provisional (S18, D11 default).

- **Server:** the Cloudflare Worker in `apps/server` handles `/api/*` (`run_worker_first`); everything else is the static app. Each room is a Durable Object (`Room`); quick match is one `Lobby` object. Game rules for rooms live in `packages/online`, pure and tested.
- **Hidden setups (D13):** a player locks a legal setup before creating, joining, or seeking a room. Until both are in, a player's view has no record, so nothing of the opponent's setup. When the second joins, the server flips the coin (crypto random) and sends both setups with the start.
- **Ruleset lock:** every lock names ruleset id and version and the protocol number; the room keeps them for all its games, and the server refuses any other version ("reload to update"). Quick match pairs only players on the same id and version.
- **Moves:** the server checks turn, ply, and legality with the engine. Draws by agreement (D8) and resignation end the game; there is no undo online. Rematch needs both players and the sides switch (D15).
- **Reconnection:** each seat has a secret token kept in the browser (`apexchess.online.v1`). A reconnect gets the whole game; the client retries with backoff (0.5 s doubling, 15 s cap). A newer socket for the same seat replaces the older one.
- **Retention (provisional):** a room is deleted 7 days after its last change (Durable Object alarm). Stated on the Privacy page.
- **Disconnects:** superseded by D19 (0007, S20a): the room's time control decides. Untimed games wait; timed clocks keep running; the abandonment-only control forfeits a player away for its grace time.
- **Local dev:** `pnpm dev:server` (builds the app, runs `wrangler dev` on 8787); `pnpm dev` proxies `/api` to it.

# Build plan (Claude Code)

This is the step-by-step plan Claude Code executes. Each step is one session and one pull request. Steps marked **Owner** are done by the project owner, sometimes with Claude in chat. Some owner steps are tracked privately and only their ids appear here.

Status values: `todo`, `doing`, `done`, `blocked`. `/end-session` updates the status of its step.

## How a session runs

1. The owner opens a new Claude Code session on this repo (claude.ai/code), sets the model and effort the step recommends, and sends `/start-session S<n>`, optionally followed by a brief pasted from the ledger.
2. Claude reads `docs/HANDOFF.md` (loaded automatically) and only this file's section for the step.
3. Claude plans, writes failing tests, implements, and commits after each green task.
4. `/end-session` runs the checks, rewrites the handoff, logs the session, ships the PR (opens, waits for CI, merges), and ends with the next session's step, model, and effort (with the `/model` and `/effort` commands to set) and a `ledger-sync` block for the owner's ledger.

## Model and effort guide (Pro plan)

| Use | Model · effort | Typical steps |
|---|---|---|
| Docs-only, renames, config | Haiku 5.5 · low | small follow-ups |
| Normal implementation with clear specs | Sonnet 5.5 · medium | scaffold, UI, deploy |
| Many cases and edge rules | Sonnet 5.5 · high | setup validator |
| Design and correctness-critical logic | Opus 5.5 · high | data formats, move generator, check detection, search AI, statistics |
| Stuck after one failed attempt | raise effort one level, or Sonnet → Opus | any |

Sonnet 5.5 is pinned as the project default in `.claude/settings.json`. Opus steps need `/model opus` at the start of the session. Fable is not used: it can bill usage credits. Avoid `max` effort except for a one-off hard bug.

**Token habits.** One step per session; start a new session for the next step. Set model and effort before the first message, not mid-session. Read only the files the step needs. Run targeted tests while working and the full suite once at the end. Keep replies and notes short: the full list is "Token efficiency" in `CLAUDE.md`.

## Phase 0: Foundation

### S1 — Foundation files and session system · Owner with Claude in chat · Opus 5.5 · high · `done`
Foundation package: license, notices, CLAUDE.md, session skills, ship script, CI and unpack workflows, branch ruleset, rules draft, this plan, and the setup steps. Done when the package and steps are delivered; S2 puts them on `main`.

### S2 — GitHub settings and apps · Owner · `todo`
Follow "GitHub setup checklist" in [DEV-WORKFLOW.md](DEV-WORKFLOW.md): repository settings, Actions permissions, Claude and DCO apps, the two workflow files, the foundation zip, then the `main` ruleset import.
Done when: the foundation files are on `main`, the ruleset is active, and a test zip unpacks and merges by itself.

### S3 — Domain and hosting account · Owner · `todo`
Point apexchess.icu at Cloudflare DNS and open the hosting account (D11).

### S4 — Settle the rules reading · Owner with Claude in chat · `todo`
Confirm or change D1 to D9 in the ledger. Claude then updates `docs/RULES.md` and the defaults table.

## Phase 1: Engine and board

### S5 — Workspace, CI, and labels · Sonnet 5.5 · medium · `done`
Scaffold the pnpm workspace: `packages/engine` (pure TypeScript, no DOM), `apps/web` (Vite + React), strict shared tsconfig, Vitest, ESLint, Prettier. Root scripts: `dev`, `build`, `test`, `lint`, `typecheck`, `validate:rules` (Ajv validation of `rules/` against `rules/schema/`; passes when `rules/` is empty). Pin Node 22 and pnpm in `package.json`. The existing `ci` job already runs these once `package.json` exists. Write the commands into CLAUDE.md. Create the issue labels the templates use (`rule-proposal`, `setup-report`, `balance-report`, `playtest`, `bug`) with `gh api`.
Pre-approved dependencies: typescript, vite, react, react-dom, @vitejs/plugin-react, vitest, eslint, typescript-eslint, prettier, ajv, ajv-formats.
Done when: CI passes on the PR, `pnpm dev` serves a blank app shell, and `validate:rules` passes.
Decisions: D12.

### S6 — Rules data: board, setups, rulesets · Opus 5.5 · high · `done`
Design and validate the data formats from `docs/RULES.md`: `rules/parameters.json` (registry: id, default, options, status, affects), `rules/rulesets/standard.json` (the default rules), `rules/setups/default.json` (the default arrangement), and setup constraints as data (the home region up to the front chord, how many pieces may stand beyond it, and where; king square). Include each side's forward direction, far edges, and promotion square as data. Add the schemas and loader with tests.
Done when: the default setup and ruleset load, validate, and resolve with no null values; the constraint data accepts the default setup and rejects hand-made illegal ones.
Decisions: D4, D5, D6.

### S7 — Move generator with Apex pawns · Opus 5.5 · high · `done`
Pseudo-legal moves for king, queen, rook, bishop, and knight from movement data; the Apex pawn (ray step, edge-sharing captures, far-edge travel, promotion on the far light corner only, any of four pieces); no castling or en passant. Hand-worked fixture positions for every pawn case, each pawn parameter at every option.
Done when: fixtures pass for both sides, including far-edge and corner cases.
Decisions: D1, D2, D3, D7.

### S8 — Check, checkmate, and draws · Opus 5.5 · high · `done`
Attack maps from the same movement data, legal moves, check, checkmate, stalemate, threefold repetition, fifty-move rule, insufficient material.
Done when: check and mate fixtures pass, including pawn attacks near the corners.
Decisions: D8.

### S9 — Diamond board renderer · Sonnet 5.5 · medium · `done`
SVG board turned 45° with the player's own king at the bottom, coordinates, placeholder pieces, square colors from the board data, responsive to phone width, tap targets large enough on a phone.
Done when: both seat views render the default setup correctly.
Decisions: D4.

### S10 — Hot-seat game with the default setup · Sonnet 5.5 · medium · `done`
Game state, turns, legal-move highlighting, promotion picker, game end, a full sample game fixture; every game keeps the ruleset id and version and both setups.

## Phase 2: Setup builder

### S11 — Setup validator and setup codes · Sonnet 5.5 · high · `done`
Validate Player's Choice arrangements from the constraint data; a short shareable setup code; a canonical setup id that treats mirror images (reflection across the h1 to a8 ray) as one family for statistics.
Done when: legal and illegal arrangement fixtures pass and codes round-trip.
Decisions: D5, D6.

### S12 — Setup builder, saved setups, presets · Sonnet 5.5 · medium · `done`
Drag or tap pieces into the home area, live validation, save arrangements on the device, a list of presets, and hot-seat games with two custom setups.
Decisions: D14.

## Phase 3: Playable product

### S13 — Computer opponent · Opus 5.5 · high · `done`
A random legal mover first, then a search AI on our own engine so it respects any ruleset and setup. The computer picks its setup from the presets.

### S14 — Play aids, rules screen, mobile layout · Sonnet 5.5 · medium · `done`
Show-legal-moves toggle, last-move highlight, undo (off in online play), pieces-in-danger indicator, sound toggle, a rules screen with The Elbow Room note, and a phone layout.
Decisions: D9.

### S15 — Self-play harness and setup statistics · Opus 5.5 · high · `done`
Bot self-play across setups; reports of wins, losses, draws, and win percentage by setup family and setup features, plus the first-move score. Measures and thresholds are written down before the first run.

## Phase 4: Public launch

### S16 — Deploy · Sonnet 5.5 · medium · `done`
Deploy the static app to apexchess.icu, privacy policy page, no blank screens on errors.
Decisions: D11.

### S17 — Outside testers · Owner · `todo`

## Later phases

### S18 — Phase 5: Online play with hidden setups · Opus 5.5 · high · `done`
Rooms, matchmaking, the server holds both setups hidden until the start, server coin flip, reconnection, ruleset lock per game. Decisions: D13. Record: `docs/decisions/0005-online-play.md`.

### S19 — Phase 6: Accounts, ratings, and public setup statistics · Opus 5.5 · high · `done`
Plan only (the S19 default): design, privacy review, and sub-steps. Decisions: D16 to D18 (open). Record: `docs/decisions/0006-accounts-ratings-stats.md`.

### S19a — Phase 6: Anonymous game archive · Opus 5.5 · high · `done`
Finished online games go to D1 as anonymous records (ruleset id and version, setups, moves, result, end day). Privacy page updated in the same PR, with no archiving of earlier games. Adds rate limiting on `/api`. Decisions: D18 (default).

### S19b — Phase 6: Public setup statistics · Opus 5.5 · high · `done`
A daily aggregate of the archive using the 0003 measures (N ≥ 30, Bonferroni bar); a JSON snapshot per ruleset version and a Stats page. Decisions: D18 (default).

### S19c — Phase 6: Accounts · Opus 5.5 · high · `done`
Passkey plus handle, recovery codes, account deletion, handle policy, Terms. D16 decided (passkey + handle, no email); minimum age 13. Built as recorded in 0006.

### S19d — Phase 6: Ratings · Opus 5.5 · high · `done`
Glicko-2 per ruleset id for signed-in quick-match games. Built on the D17 default (provisional), with D19's time and abandonment rules for unfinished games. Record: 0006.

### S20 — Phase 7: Tournaments and growth · Opus 5.5 · high · `done`
Plan only (the S20 default): design, privacy review, and sub-steps. Decisions: D19 and D20 (open). Record: `docs/decisions/0007-tournaments-growth.md`.

### S20a — Phase 7: Clocks · Opus 5.5 · high · `done`
Server-kept Fischer clocks for rooms and quick match, using the D19 presets plus untimed. Covers flag fall, the insufficient-material draw (D8), the clock running while a player is disconnected, the time control in the archive record, and the Privacy text. Decisions: D19 (default).

### S20b — Phase 7: Share and replay · Sonnet 5.5 · medium · `done`
Setup links open the builder with a setup code. Game links carry ruleset, setups, and moves and open a replay viewer. Links are made only in the player's browser and nothing is stored on the server. No decision needed.

### S20c — Phase 7: Tournaments · Opus 5.5 · high · `done`
Private events by link: event display names, round robin or Swiss pairing, byes, tiebreaks, crosstable, `noindex`, deletion 7 days after the last game, and the Privacy text. Needs S20a. Decisions: D20 (default), D19.

### S20d — Phase 7: Leaderboards · Opus 5.5 · high · `done`
Opt-in leaderboards per ruleset id. Needs S19c and S19d (both done). Built as recorded in 0006 (provisional: one switch per account, settled ratings only, top 50).

## Decision defaults

The owner decides in the ledger. Until a decision is made, its default applies when the step that needs it starts, marked provisional. Private decisions are not listed here.

| ID | Topic | In effect | Needed by |
|---|---|---|---|
| D1 | Pawn move and capture | Decided: one square straight ahead along its ray (no capture); captures one square forward and to the side, on the two edge-sharing forward squares | S7 |
| D2 | Pawn on a far edge | Decided: it advances one square along the edge toward the opposing king's corner, and that square is also its capture square | S7 |
| D3 | Pawn first move | Decided: one square only by default; rule option `pawnFirstMove: two` (two squares along its ray) | S7 |
| D4 | Which corner is light | Decided: light's king on h1, dark's on a8; each player sees their own king at the bottom | S6 |
| D5 | Where the one piece beyond the front chord may start | Decided: on the next chord only (c1 to h6 for light, f8 to a3 for dark) | S6 |
| D6 | Bishops on the same color in Player's Choice | Decided: allowed | S6 |
| D7 | Captures on the first move | Decided: allowed by default; rule option `firstMoveCaptures: forbidden` | S7 |
| D8 | Draw rules | Decided: stalemate, threefold repetition, fifty-move rule, insufficient material, and agreement are draws | S8 |
| D9 | Name for files and ranks on the turned board | Decided: keep "files and ranks" | S14 |
| D10 | License | Default (applied): PolyForm Shield 1.0.0 with a CLA and DCO sign-off, as in Chess Nines | S1 |
| D11 | Hosting | Default (applied, provisional): Cloudflare (Workers with Static Assets); confirm terms at signup; see decisions/0004 | S16 |
| D12 | Engine code from Chess Nines | Decided: a separate engine in this repo that copies patterns, not a shared package | S5 |
| D13 | Hidden setups online | Decided: each player locks a saved setup before matchmaking; the server reveals both at the start, then flips the coin | S18 |
| D14 | Hidden setups in hot-seat play | Decided: each player builds a setup while the other looks away; both are revealed at the start | S12 |
| D15 | Sides when two players play again | Decided: they alternate sides | S5 |
| D16 | Sign-in | Decided: passkey + handle, no email; minimum age 13 (0006) | S19c |
| D17 | Ratings | Open; default: Glicko-2, one pool per ruleset id, signed-in quick match only (0006) | S19d |
| D18 | Public setup statistics | Open; default (provisional): aggregates only, N ≥ 30, from anonymous archived games (0006) | S19a |
| D19 | Time controls | Decided 2026-10-22: all options offered (untimed, Fischer, fixed time per move, abandonment only), default 10+0; presets in `rules/timeControls.json` (Claude's choice, provisional); running out of time loses unless the opponent has insufficient material (0007) | S20a |
| D20 | Tournaments | Open; default (provisional): private events by link; round robin up to 8 players, Swiss above; sides set by pairing (0007) | S20c |

## Ledger sync format

`/end-session` ends with a fenced block tagged `ledger-sync` that the owner pastes into the ledger. `project` must be `apex`:

```json
{"v":1,"project":"apex","session":"S5","date":"YYYY-MM-DD","model":"sonnet","effort":"medium","outcome":"done","pr":2,"merged":true,
 "steps":{"S5":"done"},"resolved":["I3"],
 "newIssues":[{"title":"...","severity":"med","detail":"...","links":["S6"]}],
 "questions":[{"title":"...","options":["...","..."],"default":0,"neededBy":"S7"}],
 "next":{"step":"S6","model":"opus","effort":"high","why":"..."}}
```

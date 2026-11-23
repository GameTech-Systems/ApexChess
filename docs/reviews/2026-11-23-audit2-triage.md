# Outside audit 2 (2026-11-23): triage

A launch-readiness audit pasted by the owner. It read the public repo over the web (no clone, no test run) and saw some files from before S22 to S27. Each finding was checked against the code at `1bc102b`.

| # | Finding | Verdict | Action |
|---|---|---|---|
| A | Deploy skips without secrets; no smoke test | Out of date: S22 fixed both (`deploy.yml` fails on a missing secret; `scripts/smoke.mjs` runs after deploy) | Accepted in part: deploy now runs validate, lint, typecheck and test before migrating; rollback written in `DEV-WORKFLOW.md`. Done here |
| B | `RULES.md` says draft 0.1 while README says the rules are settled | Real | README fixed. The Rules page now shows the live ruleset id, version and status from data (D21 default). Publishing 1.0 stays an owner decision (D21). Done here |
| C | Launch-plan rows still `todo` | Real: S22, S24, S26, S27 rows were never ticked | `LAUNCH-PLAN.md` statuses fixed. Done here |
| D1 | One rate limit (60/min per address) for all of `/api` | Real (already marked provisional) | New step S30 |
| D2 | Abuse tests: forged moves, stale messages, wrong seat | Mostly covered (`room.test.ts`: illegal move, stale ply, seat by token, third player, wrong ruleset) | S30 adds replayed and out-of-turn messages, expired tickets, recovery-code brute force |
| D3 | Monitoring and alerts | Real, owner-side (Cloudflare dashboard) | Owner question; listed in S25 |
| D4 | Migration failure, backup and restore, account deletion across tables | Real for restore drills | S25 (owner: D1 Time Travel restore drill); deletion test reviewed in S30 |
| E | Every page shares the home page's title and canonical for non-JS crawlers | Real: S28-post removed the static info pages | Build now writes `<page>/index.html` per address with its own title, description, canonical, share tags and noscript text; smoke test checks `/rules/`. Full pre-rendered page text: S31 |
| 2 | Interactive tutorial (five lessons) | Accepted | New step S32 (teaches existing rules only) |
| 2 | Guided first game, mobile touch, reconnect UX | Partly covered (S14 mobile layout, room rejoin) | Judged in S25 live checks; problems become issues |
| 2 | AI difficulty calibration | Already in `LAUNCH-PLAN.md` ("not strength claims until testers play each level") | No new step |
| 2 | PGN export | Accepted, later | New step S33 (standard coordinates make it possible; Apex tags need owner approval) |
| 2 | Move explanations, setup explorer, rematch, spectator, achievements, AI review, weekly events | Deferred: growth features, not launch needs | No step; revisit after S29 |
| 3 | Pre-launch test matrix | Covered by existing tests plus S25 | — |
| 3 | Property tests for the engine | Accepted | `packages/engine/src/properties.test.ts`: legal moves never leave the king attacked, captures remove one piece, moves do not mutate, royal count, mate/stalemate results, 180° mirror symmetry; every parameter option. Done here |
| 5 | Launch strategy | Matches `LAUNCH-PLAN.md` | — |

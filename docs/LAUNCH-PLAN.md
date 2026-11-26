# Launch plan

From the outside audits of 2026-11-20 and 2026-11-23 (both: controlled beta recommended), checked against the code; triage of the second: `docs/reviews/2026-11-23-audit2-triage.md`. Step ids are in `docs/BUILD-PLAN.md`, Phase 8. No advertising and no analytics during the beta: feedback is voluntary.

## Before the public beta
| Item | Step | Status |
|---|---|---|
| Label the live ruleset version, or publish ruleset 1.0 (D21) | S24 | done: `standard` 1.0.0 official (2026-11-26) |
| Rated play, leaderboards, tournaments: marked Beta or off (D22) | S24 | done |
| Contact address on Privacy, Terms, footer, security.txt | — | done |
| Archive retention stated in Privacy (D23); check the "cannot be linked" claim against unique game records | S24 | done |
| CI runs `pnpm build`; deploy fails without its secrets; deployed commit visible; smoke test after deploy | S22 | done |
| Live checks: two devices on two networks, quick match, invites, reconnect, disconnect, clocks, passkey sign-up, sign-in, recovery, account deletion, D1 migrations, scheduled stats | S25 | todo |
| Deploy also runs validate, lint, typecheck, test; rollback written down | — | done |
| Engine property tests over every parameter option | — | done |
| Endpoint limits for sign-up, passkey challenges, recovery, room create; abuse tests | S30 | done |
| In-app feedback route (About page and footer), HSTS header | — | done |
| Monitoring: alerts on Worker errors and 429s; D1 restore drill | S25 | todo |
| 20 to 30 outside testers, serious problems fixed | S17 | doing |

## Before wider promotion
| Item | Step |
|---|---|
| AI: search check evasions at the horizon, score mate and stalemate there, full-state repetition key, horizon tests | S23 |
| Current mobile and desktop browsers | S25 |
| Crawlable pages: each address has its own title, description and canonical (done); full page text pre-rendered | S26, S31 |
| Interactive rules tutorial | S32 |
| PGN export | S33 |
| Name and trademark search (I1) | Owner |
| Outside review after each major update | S28 |
| Offline play, hot-seat and computer only (D24) | S27 |

Difficulty names are not strength claims until human testers have played each level.

## Community launch (S29, owner)
- **A. First players:** 20 to 30 testers from chess-variant and indie-game communities (check each community's rules). Give tasks: ten moves, one full game, one custom setup, one game against a person. Ask: "What was the first thing you found confusing, unintuitive or frustrating?"
- **B. Material:** three images (the turned board, pawn moves, a custom setup) and one 20 to 30 second video: board, pawn move and capture, custom setup, a game, the address.
- **C. Channels:** Reddit and Discord first, then an itch.io listing that links out (the site blocks iframes), GitHub releases with known issues, indie directories, short YouTube videos.
- **D. Invites:** make "Play Apex Chess with a friend" (room link) prominent; a weekly open-play session; an 8-player event only once a regular pool exists.

Positioning: "Chess, shifted 45°." A variant for variant players, not a replacement for mainstream chess sites.

First 30 days (targets, not forecasts): 20 to 30 testers, 100 first-time players, 50+ completed games, 20+ returning players, 10+ friend invites, 2 to 4 community events. Count by hand or from server totals already kept; add no tracking without a Privacy update first.

## Beta gates

The full strategy (phases, channels, messaging, risks) is kept outside the repo; these are its gates.

| Gate | Passes when |
|---|---|
| 0. Pre-flight → closed beta | S25 live checks pass on two devices and two networks; alerts set; one D1 restore drill done; `www` redirects |
| 1. Closed beta → open beta | 15+ testers finished all four tasks; no open serious bug for 7 days; the top three "first confusing thing" answers have a fix or an issue; S32 shipped |
| 2. Open beta → wider promotion | 30-day targets above mostly met; S33 shipped; name and trademark search done; ratings-reset policy for the end of beta announced |

Ruleset 1.0.0 is immutable. Balance or clarity findings during the beta are collected (issues, `pnpm sim`, the Stats page at N ≥ 30) and ship together as 1.1.0, not as edits to 1.0.0. Ratings are one pool per ruleset id, so a new version keeps everyone's rating.

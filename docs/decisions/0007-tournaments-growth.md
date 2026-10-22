# 0007: Tournaments and growth

Date: 2026-10-22 · Status: proposed (S20, plan only). D19 and D20 are open; their defaults below are provisional until the owner decides.

## Order of work

Tournaments need clocks: without them a round cannot end when a player walks away (0005 "Disconnects"). Clocks also give S19d the abandonment rule it waits on. Sharing needs no decision and no accounts, so it can ship at any time.

1. **S20a: clocks (D19).** Online rooms and quick match offer time controls; the server keeps the clock. Untimed play stays available.
2. **S20b: share and replay.** Links that open a setup (setup code from S11) or a finished game, plus a replay viewer. Everything is in the link and read in the browser, so nothing new is stored on the server.
3. **S20c: tournaments (D20).** Anyone can create an event and share its link; players join with a display name for that event only. Needs S20a.
4. **S20d: leaderboards.** Opt-in, per ruleset id. Needs S19c and S19d, so it is blocked.

## Privacy review

- **Clocks:** the server stores remaining time with the room, which is deleted after 7 days as before. The archive gains only the time control and a `time` result reason. It stores no timestamps.
- **Share links:** a game link carries the ruleset id and version, both setups, and the moves. It holds no names, tokens, or room codes. Only a player who has the game in their own browser can make one, and the server never stores it. This keeps D18: no individual games are published by the site.
- **Event names:** a display name exists only inside its event and is deleted with it, 7 days after the last game. It uses the handle policy planned for S19c (length, characters, reserved names, a report path). The Privacy page tells players not to use their real name. Event games go to the archive anonymously like any other game, without names or event id.
- **Event pages** can be opened only by people who have the link. They are not listed or indexed (`noindex`).
- **Dependencies:** none new. Pairing, tiebreaks, and clocks are written in-house.

## Open decisions and defaults

| ID | Question | Options | Default (provisional) |
|---|---|---|---|
| D19 | Time controls | none; Fischer increment; fixed time per move; abandonment rule only | Fischer increment, presets 3+2, 5+3, 10+5, 15+10 (minutes + seconds) plus untimed. Quick match pairs only within the same preset. The clock keeps running while a player is disconnected. Running out of time loses, except that it is a draw when the opponent could not checkmate under D8's insufficient-material test. |
| D20 | Tournaments | none; round robin; Swiss; arena. Setups: one per event, or a new one each round | Private events by link, 4 to 32 players, one ruleset id and version and one D19 preset per event. Round robin up to 8 players, otherwise Swiss with ⌈log₂ n⌉ + 1 rounds (no repeat pairings, side balance). A player who cannot be paired gets a 1-point bye, at most once. Tiebreaks: Sonneborn-Berger (round robin), Buchholz (Swiss). Each game locks a new setup under D13, but pairing decides sides; the coin flip is used only to settle round 1. A player absent when the round starts loses on time. |

## Not decided here

- **Rated events** wait on S19d. Until then, event games are unrated.
- **Public event listings, prizes, and arenas** are left for later. Arenas need a lobby that always runs and constant pairing.
- **Why sides come from pairing in events:** the coin flip in D13 keeps a single game fair. Over many rounds, balancing light and dark is fairer, so D20 changes this for events only, and the owner confirms it.

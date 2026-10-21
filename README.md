# Apex Chess

A chess variant played with the standard pieces on a standard board turned 45°, so each player's king starts in its own light corner. Players can bring their own starting arrangement, and rules ship as data so new setups and rule sets are easy to add.

The game will be played at **apexchess.icu**. This repository holds the game's code, rules text, and rule data.

## The game in brief

- **The board** is an ordinary 8×8 board turned 45°. Light's king starts on h1 and dark's on a8, the two light corners.
- **Chords and rays.** A chord is a side-to-side line across the turned board; a ray runs forward and back. Bishops travel along chords and rays; rooks travel along files and ranks, which run on the slant.
- **Pawns** step forward along their ray toward the opposing king's corner, capture one square forward and to the side, and promote only on the far light corner.
- **Player's Choice.** Arrange your own pieces under two rules: your king starts in your light corner, and only one piece may start beyond your front chord (d1 to h5 for light, e8 to a4 for dark). Online, you see your opponent's arrangement only when the game begins, and a coin flip decides who plays light and moves first.
- No castling and no en passant.

The full rules, including the default setup, are in [docs/RULES.md](docs/RULES.md). They are a draft: items marked provisional follow a default that has not been confirmed yet.

## The Elbow Room

Any existing chess set can be used for live play in this octant style: turn the board 45° so each king sits on its light corner, then play with personalized setups and rules. For live games played with special or altered rules, keep a printout or a written copy of the rule set at the table.

## Status

Foundation stage. The build plan is [docs/BUILD-PLAN.md](docs/BUILD-PLAN.md) and the current state is [docs/HANDOFF.md](docs/HANDOFF.md).

## License

The code, rules text, and rule data are **source-available** under the [PolyForm Shield License 1.0.0](LICENSE). This is not an open source license. The name "Apex Chess", logos, art, and other brand assets are reserved; see [NOTICE](NOTICE) and [TRADEMARKS.md](TRADEMARKS.md).

## Contributing

Rule ideas, setup reports, and bug reports are welcome. Please read [CONTRIBUTING.md](CONTRIBUTING.md) and the [Code of Conduct](CODE_OF_CONDUCT.md) first.

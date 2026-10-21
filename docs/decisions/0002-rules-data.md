# 0002: Rules data and owner rule decisions

Date: 2026-10-21 · Status: accepted

## Decisions

- **Owner decisions D1 to D9 and D12 to D15** are decided at their defaults, except D3 and D7, which keep the default and add a rule option: `pawnFirstMove` (`one` or `two`) and `firstMoveCaptures` (`allowed` or `forbidden`).
- **Data layout:** `rules/parameters.json` is the parameter registry; `rules/boards/` holds geometry per side (corner, forward step, far edges, promotion squares, mirror); `rules/setups/` holds arrangements written for light; `rules/rulesets/` pins a board and default setup by id and version and holds the setup constraints and parameter values.
- **Chords** are counted from a side's corner: chord = (square − corner) · forward. The home region is chords 0 to `frontChord`; `beyondFrontChord` lists the chords and the number of pieces allowed past it.
- **Movement (S7):** `rules/pieces/` holds each piece's movement entries (steps written for light, range, mode `move`/`capture`/`both`, and optional `onFarEdge`, `firstMove`, and `when` parameter conditions) and its promotion choices; a ruleset pins one by id and version. Promotion happens on the board side's `promotionSquares`. D7 (`firstMoveCaptures`) is a game rule applied by the generator on plies 0 and 1.
- **Check and draws (S8):** attack maps come from capture-capable movement entries (D7 does not remove attacks, owner 2026-10-21). Pieces flag `royal` (never left attacked; mate wins) and `resetsMoveRule`. A ruleset's `draws` holds `repetitions`, `moveRule` (moves per side), and `insufficientMaterial` cases (exact non-royal `pieces`, or any number of one `sameColor` piece). Repetition compares pieces, side to move, and legal moves. Stalemate and insufficient material are automatic. Repetition and the move rule are claimed by default (`draws.mode: claim`, owner 2026-10-21); `auto` ends the game by itself, and `newGame(..., { drawMode })` overrides per game. `claimableDraws` and `claimDraw` expose the claim.
- A ruleset parameter set to `null` is undecided; the engine refuses to resolve it.

## Why

Geometry and setup rules as data let new boards, presets, and rule options ship without engine changes, and one formula serves both sides.

# 0002: Rules data and owner rule decisions

Date: 2026-10-21 · Status: accepted

## Decisions

- **Owner decisions D1 to D9 and D12 to D15** are decided at their defaults, except D3 and D7, which keep the default and add a rule option: `pawnFirstMove` (`one` or `two`) and `firstMoveCaptures` (`allowed` or `forbidden`).
- **Data layout:** `rules/parameters.json` is the parameter registry; `rules/boards/` holds geometry per side (corner, forward step, far edges, promotion squares, mirror); `rules/setups/` holds arrangements written for light; `rules/rulesets/` pins a board and default setup by id and version and holds the setup constraints and parameter values.
- **Chords** are counted from a side's corner: chord = (square − corner) · forward. The home region is chords 0 to `frontChord`; `beyondFrontChord` lists the chords and the number of pieces allowed past it.
- A ruleset parameter set to `null` is undecided; the engine refuses to resolve it.

## Why

Geometry and setup rules as data let new boards, presets, and rule options ship without engine changes, and one formula serves both sides.

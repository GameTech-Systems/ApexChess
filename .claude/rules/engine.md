---
paths:
  - "packages/engine/**"
  - "packages/sim/**"
---

# Engine rules

- Pure TypeScript. No DOM, React, or browser imports. No `Date.now()` or `Math.random()` in game logic; take a seeded random source as an argument.
- Deterministic: the same position, ruleset, and inputs always give the same result.
- Piece behavior comes from movement data, board data, and resolved parameters. No `if (piece === "queen")` branches.
- Check and checkmate come from attack maps built from the same movement data, so pawn captures and any future rule options change attacks and moves together.
- Positions use standard a1 to h8 coordinates. Forward direction, far edges, and promotion squares come from data, per side.
- Every parameter is tested at its default and at each option. Positions live in `test/fixtures/` as data.
- Refuse to start a game whose resolved ruleset still has a null value.

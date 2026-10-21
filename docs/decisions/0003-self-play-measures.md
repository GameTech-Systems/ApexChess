# 0003: Self-play measures and thresholds

Date: 2026-10-21 · Status: provisional (S15), written before the first run; the owner may change any number here.

## Design

- **Ruleset:** `standard`, at whatever version the data holds; the report names it.
- **Bot:** the engine's `bestMove`, depth 2, node cap 3000, ties broken by a seeded random source. The same bot plays both sides.
- **Setup pool:** the default preset plus 7 random Player's Choice setups with distinct setup ids, drawn with seed 1. A random setup puts the corner piece on the corner, picks a feasible count of pieces beyond the front chord, then places the shuffled army uniformly on the remaining squares; `checkSetup` must accept it.
- **Schedule:** every ordered pair (light's setup, dark's setup), same-setup pairs included, 10 games each: 640 games. Game _i_ uses random seed `seed + i`, so a run is reproducible however it is split across processes.
- **Ply cap:** 400 plies. A capped game scores as a draw and is counted separately.
- **Records:** each game is a `GameRecord` (ruleset id and version, both setups, every move), written as JSON lines outside the repo (`sim-out/`).

## Measures

- From a setup's or a side's view: wins, draws, losses, N; **win %** = W / N; **score** = (W + D/2) / N.
- **Standard error** = standard deviation of the per-game scores (1, ½, 0) / √N; z = (score − 0.5) / SE; 95% interval = score ± 1.96·SE.
- **First-move score:** light's score over all games, and over same-setup games only (the cleanest measure, since the armies match).
- **Setup family** = setup id (a setup and its mirror image). A family's score counts every game it plays against a different family, as light and as dark.
- **Setup features**, all derived from data and unchanged by the mirror:
  - `beyond`: the piece beyond the front chord;
  - `chord1`: the pieces next to the corner piece (chord 1);
  - `front.<piece>`: how many of that piece stand on the front chord;
  - `chord.<piece>`: the chord of each non-corner piece the army holds once;
  - `sameColor.<piece>`: whether a piece the army holds twice has both copies on one square color.
- A feature value's score counts the games where the two sides' values for that feature differ, from the side that has it.

## Thresholds

- **First move:** an advantage (or disadvantage) when |z| ≥ 1.96.
- **Families and feature values:** a row is shown when N ≥ 30. It **stands out** when |z| reaches the Bonferroni critical value for a two-sided α = 0.05 over all shown rows of its table (for 8 rows, |z| ≥ 2.73).
- **Cap:** when more than 5% of games hit the ply cap, the report warns that scores are cap-sensitive.

## Why

Fixing the measures, the sample, and the bar before looking keeps the first numbers honest. Results describe this bot, not human play, and none of them changes a rule.

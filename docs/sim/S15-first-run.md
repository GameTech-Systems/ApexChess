# Self-play report

Ruleset `standard@0.1.0` · bot depth 2, node cap 3000 · seed 1 · ply cap 400 · 640 games, 0 capped (scored as draws).

Measures and thresholds: `docs/decisions/0003-self-play-measures.md`. Results describe this bot, not human play.

## First move

Light's view. An edge needs |z| ≥ 1.96.

Sample | Games | W | D | L | Win % | Score | 95% interval | z | Verdict
---|---|---|---|---|---|---|---|---|---
All | 640 | 318 | 62 | 260 | 49.7% | 54.5% | 50.9% to 58.2% | 2.42 | light ahead
Same setup both sides | 80 | 41 | 8 | 31 | 51.2% | 56.3% | 45.9% to 66.6% | 1.18 | no clear edge

## Setup families

Games against other families, as light and as dark.

Rows with at least 30 games; a row stands out at |z| ≥ 2.73 (Bonferroni, α = 0.05, 8 rows).

Setup id | Games | W | D | L | Win % | Score | 95% interval | z | Stands out
---|---|---|---|---|---|---|---|---|---
`K/BR/RQB/PPPP/PPNPP/5N` (default) | 140 | 67 | 15 | 58 | 47.9% | 53.2% | 45.4% to 61.1% | 0.80 | 
`K/BP/NPN/PRBP/RPQPP/3P2` | 140 | 65 | 15 | 60 | 46.4% | 51.8% | 43.9% to 59.6% | 0.45 | 
`K/PP/PPP/PQRR/BBNNP/3P2` | 140 | 73 | 14 | 53 | 52.1% | 57.1% | 49.3% to 64.9% | 1.80 | 
`K/PP/NPP/PBPB/QRRNP/P5` | 140 | 64 | 9 | 67 | 45.7% | 48.9% | 40.9% to 57.0% | -0.26 | 
`K/NP/QPB/RPRN/PPPPP/4B1` | 140 | 39 | 9 | 92 | 27.9% | 31.1% | 23.7% to 38.5% | -5.01 | yes
`K/QR/RNP/PPNP/PPPBB/4P1` | 140 | 54 | 11 | 75 | 38.6% | 42.5% | 34.6% to 50.4% | -1.87 | 
`K/NP/PRP/PQPN/BPPPR/2B3` | 140 | 62 | 13 | 65 | 44.3% | 48.9% | 41.0% to 56.8% | -0.27 | 
`K/PP/PNR/PPBR/BPQNP/4P1` | 140 | 82 | 22 | 36 | 58.6% | 66.4% | 59.3% to 73.6% | 4.52 | yes

## Setup features

Games where the two sides differ on the feature, from the side that has the value. Families: pool setups with that value; with few, a row mostly measures those setups.

Rows with at least 30 games; a row stands out at |z| ≥ 3.18 (Bonferroni, α = 0.05, 34 rows).

Feature | Value | Families | Games | W | D | L | Win % | Score | 95% interval | z | Stands out
---|---|---|---|---|---|---|---|---|---|---|---
beyond | bishop | 2 | 240 | 83 | 18 | 139 | 34.6% | 38.3% | 32.4% to 44.2% | -3.87 | yes
beyond | knight | 1 | 140 | 67 | 15 | 58 | 47.9% | 53.2% | 45.4% to 61.1% | 0.80 | 
beyond | pawn | 5 | 300 | 159 | 29 | 112 | 53.0% | 57.8% | 52.5% to 63.1% | 2.89 | 
chord.queen | 1 | 1 | 140 | 54 | 11 | 75 | 38.6% | 42.5% | 34.6% to 50.4% | -1.87 | 
chord.queen | 2 | 2 | 240 | 87 | 22 | 131 | 36.3% | 40.8% | 34.9% to 46.8% | -3.03 | 
chord.queen | 3 | 2 | 240 | 117 | 23 | 100 | 48.8% | 53.5% | 47.5% to 59.6% | 1.15 | 
chord.queen | 4 | 3 | 300 | 157 | 34 | 109 | 52.3% | 58.0% | 52.7% to 63.3% | 2.98 | 
chord1 | bishop+pawn | 1 | 140 | 65 | 15 | 60 | 46.4% | 51.8% | 43.9% to 59.6% | 0.45 | 
chord1 | bishop+rook | 1 | 140 | 67 | 15 | 58 | 47.9% | 53.2% | 45.4% to 61.1% | 0.80 | 
chord1 | knight+pawn | 2 | 240 | 83 | 18 | 139 | 34.6% | 38.3% | 32.4% to 44.2% | -3.87 | yes
chord1 | pawn+pawn | 3 | 300 | 163 | 37 | 100 | 54.3% | 60.5% | 55.3% to 65.7% | 3.98 | yes
chord1 | queen+rook | 1 | 140 | 54 | 11 | 75 | 38.6% | 42.5% | 34.6% to 50.4% | -1.87 | 
front.bishop | 0 | 4 | 320 | 125 | 28 | 167 | 39.1% | 43.4% | 38.2% to 48.6% | -2.48 | 
front.bishop | 1 | 2 | 240 | 129 | 25 | 86 | 53.8% | 59.0% | 53.1% to 64.8% | 2.98 | 
front.bishop | 2 | 2 | 240 | 109 | 21 | 110 | 45.4% | 49.8% | 43.7% to 55.8% | -0.07 | 
front.knight | 0 | 4 | 320 | 108 | 32 | 180 | 33.8% | 38.8% | 33.7% to 43.8% | -4.36 | yes
front.knight | 1 | 3 | 300 | 162 | 28 | 110 | 54.0% | 58.7% | 53.4% to 64.0% | 3.20 | yes
front.knight | 2 | 1 | 140 | 73 | 14 | 53 | 52.1% | 57.1% | 49.3% to 64.9% | 1.80 | 
front.pawn | 1 | 2 | 240 | 119 | 19 | 102 | 49.6% | 53.5% | 47.5% to 59.6% | 1.14 | 
front.pawn | 2 | 1 | 140 | 82 | 22 | 36 | 58.6% | 66.4% | 59.3% to 73.6% | 4.52 | yes
front.pawn | 3 | 3 | 300 | 123 | 35 | 142 | 41.0% | 46.8% | 41.5% to 52.1% | -1.17 | 
front.pawn | 4 | 1 | 140 | 67 | 15 | 58 | 47.9% | 53.2% | 45.4% to 61.1% | 0.80 | 
front.pawn | 5 | 1 | 140 | 39 | 9 | 92 | 27.9% | 31.1% | 23.7% to 38.5% | -5.01 | yes
front.queen | 0 | 5 | 300 | 109 | 34 | 157 | 36.3% | 42.0% | 36.7% to 47.3% | -2.98 | 
front.queen | 1 | 3 | 300 | 157 | 34 | 109 | 52.3% | 58.0% | 52.7% to 63.3% | 2.98 | 
front.rook | 0 | 5 | 300 | 135 | 31 | 134 | 45.0% | 50.2% | 44.8% to 55.5% | 0.06 | 
front.rook | 1 | 2 | 240 | 107 | 28 | 105 | 44.6% | 50.4% | 44.5% to 56.4% | 0.14 | 
front.rook | 2 | 1 | 140 | 64 | 9 | 67 | 45.7% | 48.9% | 40.9% to 57.0% | -0.26 | 
sameColor.bishop | no | 4 | 320 | 147 | 25 | 148 | 45.9% | 49.8% | 44.6% to 55.1% | -0.06 | 
sameColor.bishop | yes | 4 | 320 | 148 | 25 | 147 | 46.3% | 50.2% | 44.9% to 55.4% | 0.06 | 
sameColor.knight | no | 2 | 240 | 102 | 24 | 114 | 42.5% | 47.5% | 41.5% to 53.5% | -0.82 | 
sameColor.knight | yes | 6 | 240 | 114 | 24 | 102 | 47.5% | 52.5% | 46.5% to 58.5% | 0.82 | 
sameColor.rook | no | 4 | 320 | 165 | 29 | 126 | 51.6% | 56.1% | 50.9% to 61.3% | 2.30 | 
sameColor.rook | yes | 4 | 320 | 126 | 29 | 165 | 39.4% | 43.9% | 38.7% to 49.1% | -2.30 | 

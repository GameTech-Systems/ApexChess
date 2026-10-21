# Apex Chess rules (draft 0.1)

Status: **draft**. Lines marked *(Dn)* follow an owner decision; lines marked *(provisional, Dn)* follow a default the owner has not confirmed yet. The "Decision defaults" table in [BUILD-PLAN.md](BUILD-PLAN.md) lists both. Everything else is the owner's rule as written.

## 1. The board

Apex Chess uses a standard 8×8 board and standard algebraic coordinates (files a to h, ranks 1 to 8), turned 45° so the long light diagonal a8 to h1 runs from one player to the other. Each king starts in its own light corner: **light at h1, dark at a8** *(D4)*. Each player sees the board with their own king at the bottom.

Because the coordinates are the ordinary ones, any chess set, board, and notation work.

## 2. Chords and rays

- A **chord** is a side-to-side line across the turned board: a diagonal running parallel to a1 to h8. Every chord is a single color. Example: d1 to h5.
- A **ray** is a forward-and-back line: a diagonal running parallel to a8 to h1. The central ray, h1 to a8, joins the two kings.
- **Files and ranks** run on the slant across the turned board *(D9)*.

On the turned board, bishops travel along chords and rays (straight across and straight ahead), and rooks travel along files and ranks (on the slant).

## 3. Default setup

Light (king in the h1 corner), listed chord by chord from the king outward:

| Chord | Squares and pieces |
|---|---|
| h1 | King h1 |
| g1 to h2 | Bishop g1, Rook h2 |
| f1 to h3 | Rook f1, Queen g2, Bishop h3 |
| e1 to h4 | Pawns e1, f2, g3, h4 |
| d1 to h5 (front chord) | Pawn d1, Pawn e2, Knight f3, Pawn g4, Pawn h5 |
| c1 to h6 | Knight h6 (the one piece beyond the front chord) |

Dark mirrors light through the center of the board: King a8; Bishops b8 and a6; Rooks a7 and c8; Queen b7; Knights c6 and a3; Pawns d8, c7, b6, a5, e8, d7, b5, a4.

## 4. Player's Choice (custom setups)

Players may choose their own arrangement of the same 16 pieces, under two rules:

1. **King in the light corner** (h1 for light, a8 for dark).
2. **Only one piece beyond the front chord.** The front chord is d1 to h5 for light and e8 to a4 for dark. The front chord and the squares behind it hold exactly 15 squares, so that area is always full and exactly one piece starts beyond it. That piece goes on the next chord, c1 to h6 for light or f8 to a3 for dark *(D5)*. It may be any piece except the king.

Bishops may start on the same color *(D6)*.

**Setup code.** An arrangement is written as one letter per square (K, Q, R, B, N, P), chord by chord from the king outward, chords joined by `/`, digits for runs of empty squares. The default is `K/BR/RQB/PPPP/PPNPP/5N`. Light and dark use the same code. An arrangement and its mirror image (reflected across the h1 to a8 ray) share one **setup id**, the smaller of their two codes, so results can be grouped by setup.

Saved arrangements and popular presets can be offered. Online, a player does not see the opponent's arrangement until the game begins, and a coin flip decides who plays light. Light moves first.

## 5. How the pieces move

King, queen, rook, bishop, and knight move and capture as in standard chess. There is **no castling** and **no en passant**.

### Pawns *(D1)*

"Forward" means toward the opposing king's corner (for light, toward a8).

- **Move:** one square straight ahead along the pawn's ray, for example light h5 to g6. A pawn never captures this way (no head-on captures). By default there is no two-square first move; a ruleset may allow two squares along its ray on a pawn's first move (parameter `pawnFirstMove`, D3).
- **Capture:** only one square forward and to the side, onto a square that shares an edge with the pawn's square. A light pawn on h5 captures on g5 or h6.
- **Far edges:** the far edges are file a and rank 8 for light, file h and rank 1 for dark. On a far edge the pawn's ray leaves the board, so the pawn advances one square at a time along that edge toward the opposing king's corner, for example light e8 to d8 to c8 to b8 to a8. That square is also the pawn's capture square *(D2)*.
- **Promotion:** only on the far light corner, a8 for light and h1 for dark. The pawn becomes a queen, rook, bishop, or knight, chosen by its player, whether or not any piece has been captured.

Dark pawns work the same way in the opposite direction: a dark pawn on a4 moves to b3 and captures on b4 or a3.

## 6. Check, checkmate, and the end of the game

Check and checkmate work as in standard chess. Checkmate wins; a player may also resign. Stalemate, threefold repetition, the fifty-move rule, insufficient material, and agreement are draws *(D8)*.

## 7. Opening lines

With custom setups, nine lines between the two front chords can be open at the start (for example e2 to e8 along the file, and f3 to c6 along the central ray), so the player who moves first may be able to capture on move 1. This is allowed by default; a ruleset may forbid captures on each side's first move (parameter `firstMoveCaptures`, D7). The default setup has no such capture.

## 8. Future rule sets

Setups and rules are stored as data, so new arrangements, presets, and alternative rule sets can be added without rewriting the game. Every saved game records the ruleset and both setups it was played with.

## The Elbow Room

Any existing chess set can be used for live play in this octant style: turn the board 45° so each king sits on its light corner, then play with personalized setups and rules. For live games played with special or altered rules, keep a printout or a written copy of the rule set at the table.

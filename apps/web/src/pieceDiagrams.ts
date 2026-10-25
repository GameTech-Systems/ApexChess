/** Rules-screen diagrams: one piece near the middle of the board and the squares it can reach, from the engine. */
import {
  attackedSquares,
  generateMoves,
  parseSquare,
  squareName,
  type Position,
  type ResolvedRuleset,
  type Side,
} from "@apexchess/engine";

export interface Diagram {
  position: Position;
  /** Squares the piece can move to; a capture square holds an opposing piece. */
  targets: Set<string>;
  square: string;
}

/** The square on the side's central ray nearest the middle of the board (the side's own half on a tie). */
export function middleSquare(ruleset: ResolvedRuleset, side: Side = "light"): string {
  const { board } = ruleset;
  const { corner, forward } = board.sides[side];
  const c = parseSquare(board, corner);
  const mid = { file: (board.files - 1) / 2, rank: (board.ranks - 1) / 2 };
  let best = corner;
  let bestDistance = Infinity;
  for (let k = 0; ; k++) {
    const sq = { file: c.file + forward[0] * k, rank: c.rank + forward[1] * k };
    if (sq.file < 0 || sq.rank < 0 || sq.file >= board.files || sq.rank >= board.ranks) break;
    const d = (sq.file - mid.file) ** 2 + (sq.rank - mid.rank) ** 2;
    if (d < bestDistance) {
      best = squareName(sq);
      bestDistance = d;
    }
  }
  return best;
}

/**
 * The piece alone on the middle square, or, for a piece that captures differently from how it
 * moves (the pawn), with opposing pawns on the squares it captures on.
 */
export function pieceDiagram(
  ruleset: ResolvedRuleset,
  piece: string,
  side: Side = "light",
): Diagram {
  const square = middleSquare(ruleset, side);
  const enemy: Side = side === "light" ? "dark" : "light";
  const base: Position = {
    squares: { [square]: { side, piece } },
    turn: side,
    ply: 2,
    unmoved: [],
  };
  const reach = (pos: Position) => new Set(generateMoves(ruleset, pos).map((m) => m.to));
  const moves = reach(base);
  const attacks = attackedSquares(ruleset, base, side);
  const captureOnly = [...attacks].filter((sq) => !moves.has(sq));
  if (!captureOnly.length) return { position: base, targets: moves, square };
  const position: Position = {
    ...base,
    squares: {
      ...base.squares,
      ...Object.fromEntries(captureOnly.map((sq) => [sq, { side: enemy, piece }])),
    },
  };
  return { position, targets: reach(position), square };
}

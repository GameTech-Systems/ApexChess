/** Pseudo-legal moves from movement data, board data, and resolved parameters. No castling, no en passant. */
import type { Board, Movement, ResolvedRuleset, Side } from "./rules";
import { parseSquare, placeSetup, squareName, type Pieces, type Square } from "./setup";

export interface PlacedPiece {
  side: Side;
  piece: string;
}

export interface Position {
  squares: Record<string, PlacedPiece>;
  turn: Side;
  /** Half-moves played since the start; plies 0 and 1 are each side's first move. */
  ply: number;
  /** Squares whose piece has not moved yet. */
  unmoved: string[];
}

export interface Move {
  from: string;
  to: string;
  piece: string;
  captured?: string;
  promotion?: string;
}

/** Both setups (written for light) placed for their sides, first side to move, nothing moved. */
export function startPosition(ruleset: ResolvedRuleset, light: Pieces, dark: Pieces): Position {
  const squares: Position["squares"] = {};
  for (const [side, setup] of [
    ["light", light],
    ["dark", dark],
  ] as const) {
    for (const [sq, piece] of Object.entries(placeSetup(ruleset.board, side, setup)))
      squares[sq] = { side, piece };
  }
  return { squares, turn: ruleset.firstToMove, ply: 0, unmoved: Object.keys(squares) };
}

/** "h5-g6", "e4xd4", "b7-a8=queen". */
export function moveText(m: Move): string {
  return m.from + (m.captured ? "x" : "-") + m.to + (m.promotion ? "=" + m.promotion : "");
}

function onFarEdge(board: Board, side: Side, sq: Square): boolean {
  return board.sides[side].farEdges.some((e) =>
    "file" in e ? sq.file === e.file.charCodeAt(0) - 97 : sq.rank === e.rank - 1,
  );
}

function applies(m: Movement, edge: boolean, unmoved: boolean, params: Record<string, string>) {
  if (m.onFarEdge !== undefined && m.onFarEdge !== edge) return false;
  if (m.firstMove && !unmoved) return false;
  return Object.entries(m.when ?? {}).every(([k, v]) => params[k] === v);
}

/** Every pseudo-legal move for the side to move (own-king safety is not checked). */
export function generateMoves(ruleset: ResolvedRuleset, pos: Position): Move[] {
  const { board, parameters } = ruleset;
  const side = pos.turn;
  const { mirror, promotionSquares } = board.sides[side];
  const flip = mirror === "rotate180" ? -1 : 1;
  const unmoved = new Set(pos.unmoved);
  // D7: with firstMoveCaptures "forbidden", neither side captures on its first move.
  const captures = !(parameters.firstMoveCaptures === "forbidden" && pos.ply < 2);
  const moves: Move[] = [];
  const seen = new Set<string>();

  for (const [from, { side: owner, piece }] of Object.entries(pos.squares)) {
    if (owner !== side) continue;
    const rules = ruleset.pieces.pieces[piece];
    if (!rules) throw new Error(`piece ${piece} has no movement data`);
    const at = parseSquare(board, from);
    const edge = onFarEdge(board, side, at);
    const add = (to: string, captured?: string) => {
      const promos = promotionSquares.includes(to) ? (rules.promotesTo ?? []) : [];
      for (const promotion of promos.length ? promos : [undefined]) {
        const m: Move = { from, to, piece };
        if (captured) m.captured = captured;
        if (promotion) m.promotion = promotion;
        const key = moveText(m);
        if (seen.has(key)) continue;
        seen.add(key);
        moves.push(m);
      }
    };

    for (const m of rules.moves) {
      if (!applies(m, edge, unmoved.has(from), parameters)) continue;
      for (const [df, dr] of m.steps) {
        for (let n = 1; n <= (m.range ?? Infinity); n++) {
          const file = at.file + df * flip * n;
          const rank = at.rank + dr * flip * n;
          if (file < 0 || rank < 0 || file >= board.files || rank >= board.ranks) break;
          const to = squareName({ file, rank });
          const target = pos.squares[to];
          if (target) {
            if (target.side !== side && m.mode !== "move" && captures) add(to, target.piece);
            break;
          }
          if (m.mode !== "capture") add(to);
        }
      }
    }
  }
  return moves;
}

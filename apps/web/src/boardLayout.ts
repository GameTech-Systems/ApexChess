/** Diamond view geometry. Positions stay in a1 to h8 coordinates; only this module turns them 45 degrees. */
import { parseSquare, type Board, type Side } from "@apexchess/engine";

export interface Point {
  x: number;
  y: number;
}

/** Screen center of a square for the seat's view; y grows downward, each neighbour is 1 unit away on both axes. */
export function squareCenter(board: Board, view: Side, name: string): Point {
  const sq = parseSquare(board, name);
  const [fx, fy] = board.sides[view].forward;
  const df = sq.file - (board.files - 1) / 2;
  const dr = sq.rank - (board.ranks - 1) / 2;
  // Up on screen is the seat's forward direction; right is forward turned a quarter turn clockwise.
  const x = df * fy - dr * fx;
  const y = -(df * fx + dr * fy);
  return { x: x + 0, y: y + 0 };
}

/** Squares sharing the light corner's color are light. */
export function squareColor(board: Board, name: string): "light" | "dark" {
  const parity = (s: string) => {
    const sq = parseSquare(board, s);
    return (sq.file + sq.rank) % 2;
  };
  return parity(name) === parity(board.sides.light.corner) ? "light" : "dark";
}

/** Square view box, centered on the origin, with room for the edge labels. */
export function viewBoxFor(board: Board): { half: number; min: number; size: number } {
  const half = Math.max(board.files, board.ranks) + 0.6;
  return { half, min: -half, size: half * 2 };
}

/** Edge of the board facing the bottom of the screen along an axis: which line it is and which way is outward. */
export function lowerEdge(
  board: Board,
  view: Side,
  axis: "file" | "rank",
): { at: number; out: Point } {
  const o = squareCenter(board, view, "a1");
  const n = squareCenter(board, view, axis === "file" ? "b1" : "a2");
  const step = { x: n.x - o.x, y: n.y - o.y };
  const last = (axis === "file" ? board.files : board.ranks) - 1;
  return step.y > 0 ? { at: last, out: step } : { at: 0, out: { x: -step.x, y: -step.y } };
}

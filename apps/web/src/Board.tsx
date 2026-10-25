import { useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import type { Board as BoardData, PieceSet, Position, Side } from "@apexchess/engine";
import { squareName } from "@apexchess/engine";
import { lowerEdge, squareCenter, squareColor, viewBoxFor, type Point } from "./boardLayout";

export interface BoardProps {
  board: BoardData;
  position: Position;
  /** Whose seat is shown: that side's own king corner sits at the bottom. */
  view: Side;
  pieceSet: PieceSet;
  onSquareClick?: (square: string) => void;
  /** Square of the selected piece. */
  selected?: string;
  /** Squares the selected piece can move to. */
  targets?: ReadonlySet<string>;
  /** Squares of the last move played. */
  lastMove?: readonly string[];
  /** Square of a royal piece in check. */
  checked?: string;
  /** Squares of pieces that are attacked and undefended. */
  danger?: ReadonlySet<string>;
  /** Squares to call out, e.g. the chord beyond the front chord while building a setup. */
  highlight?: ReadonlySet<string>;
  /** Squares whose piece cannot be moved, e.g. the king's corner while building a setup. */
  fixed?: ReadonlySet<string>;
  /** File and rank letters along the lower edges (default on). */
  coordinates?: boolean;
  /** Accessible name; defaults to the seat. */
  label?: string;
  /** Extra drawing on top of the board, in board units (see boardLayout). */
  children?: ReactNode;
}

/** Placeholder labels only; real art comes later. */
const LABELS: Record<string, string> = { knight: "N" };
const label = (piece: string) => LABELS[piece] ?? piece.charAt(0).toUpperCase();

/**
 * Arrow keys move the focus on screen: left and right along the chord the square is on, up and down
 * to the next chord (up then down comes back to the same square).
 */
const ARROWS: Record<string, Point[]> = {
  ArrowLeft: [{ x: -2, y: 0 }],
  ArrowRight: [{ x: 2, y: 0 }],
  ArrowUp: [
    { x: 1, y: -1 },
    { x: -1, y: -1 },
  ],
  ArrowDown: [
    { x: -1, y: 1 },
    { x: 1, y: 1 },
  ],
};

export function Board({
  board,
  position,
  view,
  onSquareClick,
  selected,
  targets,
  lastMove,
  checked,
  danger,
  highlight,
  fixed,
  coordinates = true,
  label: name,
  children,
}: BoardProps) {
  const vb = viewBoxFor(board);
  const squares: string[] = [];
  for (let r = board.ranks - 1; r >= 0; r--)
    for (let f = 0; f < board.files; f++) squares.push(squareName({ file: f, rank: r }));
  const centers = new Map(squares.map((sq) => [sq, squareCenter(board, view, sq)]));
  const at = new Map(squares.map((sq) => [`${centers.get(sq)!.x},${centers.get(sq)!.y}`, sq]));

  // One tab stop for the whole board; arrow keys move between squares.
  const interactive = Boolean(onSquareClick);
  const [cursor, setCursor] = useState<string>();
  const focusable = cursor ?? selected ?? board.sides[view].corner;
  const cells = useRef(new Map<string, SVGGElement>());
  const onKeyDown = (e: KeyboardEvent, sq: string) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSquareClick?.(sq);
      return;
    }
    const steps = ARROWS[e.key];
    if (!steps) return;
    e.preventDefault();
    const c = centers.get(sq)!;
    const next = steps.map((s) => at.get(`${c.x + s.x},${c.y + s.y}`)).find(Boolean);
    if (next) {
      setCursor(next);
      cells.current.get(next)?.focus();
    }
  };

  // Files are named along the lower edge that runs across the file axis, ranks likewise.
  const fileEdge = lowerEdge(board, view, "rank");
  const rankEdge = lowerEdge(board, view, "file");

  return (
    <svg
      className="board"
      data-view={view}
      viewBox={`${vb.min} ${vb.min} ${vb.size} ${vb.size}`}
      role={interactive ? "group" : "img"}
      aria-label={name ?? `Board, ${view} seat`}
    >
      {squares.map((sq) => {
        const c = centers.get(sq)!;
        const piece = position.squares[sq];
        const points = `${c.x},${c.y - 1} ${c.x + 1},${c.y} ${c.x},${c.y + 1} ${c.x - 1},${c.y}`;
        const what = piece ? `${sq} ${piece.side} ${piece.piece}` : sq;
        return (
          <g
            key={sq}
            data-square={sq}
            className="cell"
            ref={(el) => {
              if (el) cells.current.set(sq, el);
              else cells.current.delete(sq);
            }}
            {...(interactive
              ? {
                  role: "button",
                  tabIndex: sq === focusable ? 0 : -1,
                  "aria-label": fixed?.has(sq) ? `${what}, fixed` : what,
                  "aria-pressed": selected === sq,
                  onClick: () => onSquareClick?.(sq),
                  onKeyDown: (e: KeyboardEvent) => onKeyDown(e, sq),
                  onFocus: () => setCursor(sq),
                }
              : {})}
          >
            <polygon className={`sq sq-${squareColor(board, sq)}`} points={points} />
            {highlight?.has(sq) && <polygon className="mark-chord" points={points} />}
            {lastMove?.includes(sq) && <polygon className="mark-last" points={points} />}
            {checked === sq && <polygon className="mark-check" points={points} />}
            {danger?.has(sq) && <polygon className="mark-danger" points={points} />}
            {selected === sq && <polygon className="mark-selected" points={points} />}
            {interactive && <polygon className="focus-ring" points={points} />}
            {targets?.has(sq) && (
              <circle
                className={piece ? "mark-capture" : "mark-target"}
                data-target={sq}
                cx={c.x}
                cy={c.y}
                r={piece ? 0.8 : 0.22}
              />
            )}
            {piece && (
              <g data-piece={piece.piece} data-side={piece.side} className={`pc pc-${piece.side}`}>
                <circle cx={c.x} cy={c.y} r={0.62} />
                <text x={c.x} y={c.y} textAnchor="middle" dominantBaseline="central">
                  {label(piece.piece)}
                </text>
              </g>
            )}
            {fixed?.has(sq) && <circle className="mark-fixed" cx={c.x} cy={c.y} r={0.78} />}
          </g>
        );
      })}
      {coordinates &&
        Array.from({ length: board.files }, (_, f) => {
          const sq = squareName({ file: f, rank: fileEdge.at });
          const c = centers.get(sq)!;
          return (
            <text
              key={`f${f}`}
              data-file-label={String.fromCharCode(97 + f)}
              className="coord"
              x={c.x + fileEdge.out.x * 0.85}
              y={c.y + fileEdge.out.y * 0.85}
              textAnchor="middle"
              dominantBaseline="central"
            >
              {String.fromCharCode(97 + f)}
            </text>
          );
        })}
      {coordinates &&
        Array.from({ length: board.ranks }, (_, r) => {
          const sq = squareName({ file: rankEdge.at, rank: r });
          const c = centers.get(sq)!;
          return (
            <text
              key={`r${r}`}
              data-rank-label={r + 1}
              className="coord"
              x={c.x + rankEdge.out.x * 0.85}
              y={c.y + rankEdge.out.y * 0.85}
              textAnchor="middle"
              dominantBaseline="central"
            >
              {r + 1}
            </text>
          );
        })}
      {children}
    </svg>
  );
}

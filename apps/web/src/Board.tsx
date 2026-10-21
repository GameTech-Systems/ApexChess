import type { Board as BoardData, PieceSet, Position, Side } from "@apexchess/engine";
import { squareName } from "@apexchess/engine";
import { lowerEdge, squareCenter, squareColor, viewBoxFor } from "./boardLayout";

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
}

/** Placeholder labels only; real art comes later. */
const LABELS: Record<string, string> = { knight: "N" };
const label = (piece: string) => LABELS[piece] ?? piece.charAt(0).toUpperCase();

export function Board({
  board,
  position,
  view,
  onSquareClick,
  selected,
  targets,
  lastMove,
  checked,
}: BoardProps) {
  const vb = viewBoxFor(board);
  const squares: string[] = [];
  for (let r = board.ranks - 1; r >= 0; r--)
    for (let f = 0; f < board.files; f++) squares.push(squareName({ file: f, rank: r }));

  // Files are named along the lower edge that runs across the file axis, ranks likewise.
  const fileEdge = lowerEdge(board, view, "rank");
  const rankEdge = lowerEdge(board, view, "file");

  return (
    <svg
      className="board"
      data-view={view}
      viewBox={`${vb.min} ${vb.min} ${vb.size} ${vb.size}`}
      role="grid"
      aria-label={`Board, ${view} seat`}
    >
      {squares.map((name) => {
        const c = squareCenter(board, view, name);
        const piece = position.squares[name];
        const points = `${c.x},${c.y - 1} ${c.x + 1},${c.y} ${c.x},${c.y + 1} ${c.x - 1},${c.y}`;
        return (
          <g
            key={name}
            data-square={name}
            role="gridcell"
            aria-label={piece ? `${name} ${piece.side} ${piece.piece}` : name}
            onClick={() => onSquareClick?.(name)}
          >
            <polygon className={`sq sq-${squareColor(board, name)}`} points={points} />
            {lastMove?.includes(name) && <polygon className="mark-last" points={points} />}
            {checked === name && <polygon className="mark-check" points={points} />}
            {selected === name && <polygon className="mark-selected" points={points} />}
            {targets?.has(name) && (
              <circle
                className={piece ? "mark-capture" : "mark-target"}
                data-target={name}
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
          </g>
        );
      })}
      {Array.from({ length: board.files }, (_, f) => {
        const name = squareName({ file: f, rank: fileEdge.at });
        const c = squareCenter(board, view, name);
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
      {Array.from({ length: board.ranks }, (_, r) => {
        const name = squareName({ file: rankEdge.at, rank: r });
        const c = squareCenter(board, view, name);
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
    </svg>
  );
}

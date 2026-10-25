import { useMemo, useState, type ReactNode } from "react";
import {
  setupArea,
  type Pieces,
  type Position,
  type ResolvedRuleset,
  type Side,
} from "@apexchess/engine";
import { Board } from "./Board";
import { squareCenter } from "./boardLayout";
import {
  beyondSquares,
  chordSpan,
  clearSquare,
  emptySetup,
  fromSeat,
  isLocked,
  placePiece,
  remaining,
  seatSetup,
  setupErrors,
  swapPieces,
  withCornerPiece,
  wouldOverfillBeyond,
} from "./setupBuilder";
import { copyText, setupLink } from "./share";
import { deleteSetup, loadSetups, saveSetup, type KeyValueStore } from "./savedSetups";

export interface Preset {
  name: string;
  pieces: Pieces;
}

interface Props {
  ruleset: ResolvedRuleset;
  title: string;
  presets: Preset[];
  store: KeyValueStore;
  onDone: (pieces: Pieces) => void;
  /** Arrangement to start from, e.g. one opened from a setup link. */
  initial?: Pieces;
  /** Seat the setup is built from, so the board and its coordinates match where it will start. */
  side?: Side;
  /** Extra line under the title, e.g. that the seat is decided later. */
  hint?: ReactNode;
  /** Label of the button that finishes. */
  doneLabel?: string;
}

/** Held piece: picked from the tray (no `from`) or lifted off a square (setup frame). */
interface Held {
  piece: string;
  from?: string;
}

export function SetupBuilder({
  ruleset,
  title,
  presets,
  store,
  onDone,
  initial,
  side = "light",
  hint,
  doneLabel = "Done",
}: Props) {
  const [pieces, setPieces] = useState<Pieces>(() => withCornerPiece(ruleset, initial ?? {}));
  const [copied, setCopied] = useState(false);
  const [held, setHeld] = useState<Held>();
  const [saved, setSaved] = useState(() => loadSetups(store));
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");

  const { constraints } = ruleset.setup;
  const { maxPieces, chords } = constraints.beyondFrontChord;
  const cornerSquare = ruleset.board.sides[side].corner;
  const beyond = useMemo(() => beyondSquares(ruleset), [ruleset]);
  const onSeat = (squares: string[]) =>
    new Set(Object.keys(seatSetup(ruleset, side, Object.fromEntries(squares.map((s) => [s, ""])))));
  const shownBeyond = onSeat(beyond);
  const area = onSeat(setupArea(ruleset));
  const left = remaining(ruleset, pieces);
  const toPlace = Object.values(left).reduce((a, b) => a + Math.max(0, b), 0);
  const total = Object.values(ruleset.army).reduce((a, b) => a + b, 0);
  const errors = setupErrors(ruleset, pieces, side);
  const placementErrors = errors.filter((e) => e.code !== "army");
  const frontSpan = chordSpan(ruleset, side, constraints.frontChord);
  const beyondSpan = chordSpan(ruleset, side, chords[0]!);
  const onePiece = maxPieces === 1 ? "one piece" : `${maxPieces} pieces`;

  const position: Position = {
    squares: Object.fromEntries(
      Object.entries(seatSetup(ruleset, side, pieces)).map(([sq, piece]) => [sq, { side, piece }]),
    ),
    turn: side,
    ply: 0,
    unmoved: [],
  };

  const update = (next: Pieces) => {
    setPieces(next);
    setCopied(false);
  };

  const onSquareClick = (shown: string) => {
    setMessage("");
    if (!area.has(shown)) return setHeld(undefined);
    const square = fromSeat(ruleset, side, shown);
    if (isLocked(ruleset, square)) {
      setHeld(undefined);
      return setMessage(`Your ${constraints.cornerPiece} is fixed on ${cornerSquare}.`);
    }
    if (held) {
      if (held.from === square) return setHeld(undefined);
      if (wouldOverfillBeyond(ruleset, pieces, square, held.from)) {
        setHeld(undefined);
        return setMessage(
          `Only ${onePiece} may start on the highlighted chord (${beyondSpan}). Move the piece that is there first, or drop this one onto it to swap.`,
        );
      }
      update(
        held.from
          ? swapPieces(ruleset, pieces, held.from, square)
          : placePiece(ruleset, pieces, square, held.piece),
      );
      return setHeld(undefined);
    }
    const piece = pieces[square];
    setHeld(piece ? { piece, from: square } : undefined);
  };

  const load = (next: Pieces) => {
    update(withCornerPiece(ruleset, next));
    setHeld(undefined);
    setMessage("");
  };

  // The note sits over the empty part of the board, above the chord it points at.
  const centers = [...shownBeyond].map((sq) => squareCenter(ruleset.board, side, sq));
  const rowY = Math.min(...centers.map((c) => c.y));
  const at = (n: number) => Math.round(n * 100) / 100;
  const note = `Only ${maxPieces} piece${maxPieces === 1 ? "" : "s"} on this chord`;
  // Width of the note's backing pill: about 0.56 em per character at 0.62 board units, plus padding.
  const noteWidth = at(note.length * 0.62 * 0.56 + 0.9);
  const row = centers.filter((c) => c.y === rowY);
  const midX = row.reduce((a, c) => a + c.x, 0) / (row.length || 1);
  const arrowX = row.reduce(
    (best, c) => (Math.abs(c.x - midX) < Math.abs(best - midX) ? c.x : best),
    Infinity,
  );
  const shownHeld = held?.from ? [...onSeat([held.from])][0] : undefined;

  return (
    <section aria-label="Setup builder" className="builder">
      <h2>{title}</h2>
      <p className="lede">
        You set up as {side}. Your {constraints.cornerPiece} is fixed on {cornerSquare}. Fill every
        square up to the front chord ({frontSpan}); {onePiece} goes on the highlighted chord beyond
        it ({beyondSpan}). Pick a piece below, then tap a square. Tap a placed piece and then
        another square to swap them.
      </p>
      {hint && <p className="hint">{hint}</p>}
      <Board
        board={ruleset.board}
        position={position}
        view={side}
        pieceSet={ruleset.pieces}
        onSquareClick={onSquareClick}
        selected={shownHeld}
        targets={held ? new Set([...area].filter((sq) => sq !== cornerSquare)) : undefined}
        highlight={shownBeyond}
        fixed={new Set([cornerSquare])}
        label={`Setup board, ${side} seat`}
      >
        {row.length > 0 && (
          <g className="callout" aria-hidden="true">
            <rect
              x={at(midX - noteWidth / 2)}
              y={at(rowY - 2.82)}
              width={noteWidth}
              height={1}
              rx={0.5}
            />
            <text x={at(midX)} y={at(rowY - 2.3)} textAnchor="middle" dominantBaseline="central">
              {note}
            </text>
            <line x1={arrowX} y1={at(rowY - 1.82)} x2={arrowX} y2={at(rowY - 1.05)} />
            <polygon
              points={`${at(arrowX - 0.24)},${at(rowY - 1.12)} ${at(arrowX + 0.24)},${at(rowY - 1.12)} ${arrowX},${at(rowY - 0.72)}`}
            />
          </g>
        )}
      </Board>
      <p role="status" className="builder-status">
        {message ||
          (held
            ? `Holding a ${held.piece}. Tap a square to ${held.from ? "put it there or swap" : "place it"}.`
            : toPlace > 0
              ? `${total - toPlace} of ${total} pieces placed. ${toPlace} to go.`
              : placementErrors.length
                ? ""
                : "All pieces placed. Ready to play.")}
      </p>
      <div role="group" aria-label="Pieces to place" className="tray">
        {Object.keys(ruleset.army)
          .filter((piece) => piece !== constraints.cornerPiece)
          .map((piece) => (
            <button
              key={piece}
              type="button"
              aria-pressed={held?.piece === piece && !held.from}
              disabled={left[piece] === 0}
              onClick={() => {
                setMessage("");
                setHeld(held?.piece === piece && !held.from ? undefined : { piece });
              }}
            >
              {piece} ×{left[piece]}
            </button>
          ))}
        <button
          type="button"
          disabled={!held?.from}
          onClick={() => {
            update(clearSquare(ruleset, pieces, held!.from!));
            setHeld(undefined);
          }}
        >
          Remove
        </button>
        <button type="button" onClick={() => load(emptySetup(ruleset))}>
          Clear
        </button>
      </div>
      <ul aria-label="Setup problems" className="errors">
        {placementErrors.map((e) => (
          <li key={e.message}>{e.message}</li>
        ))}
      </ul>
      <div className="controls">
        <label>
          Preset{" "}
          <select
            value=""
            onChange={(e) => {
              const hit = presets.find((p) => p.name === e.target.value);
              if (hit) load(hit.pieces);
            }}
          >
            <option value="">Choose…</option>
            {presets.map((p) => (
              <option key={p.name}>{p.name}</option>
            ))}
          </select>
        </label>
        <label>
          Name <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} />
        </label>
        <button
          type="button"
          disabled={errors.length > 0 || !name.trim()}
          onClick={() => {
            saveSetup(store, name, pieces);
            setSaved(loadSetups(store));
          }}
        >
          Save on this device
        </button>
        <button
          type="button"
          disabled={errors.length > 0}
          onClick={async () => {
            const url = location.origin + location.pathname + setupLink(ruleset, pieces);
            setCopied(await copyText(url));
          }}
        >
          {copied ? "Link copied" : "Copy setup link"}
        </button>
      </div>
      {saved.length > 0 && (
        <ul aria-label="Saved setups" className="saved">
          {saved.map((s) => (
            <li key={s.name}>
              {s.name}{" "}
              <button type="button" onClick={() => load(s.pieces)}>
                Load
              </button>
              <button
                type="button"
                onClick={() => {
                  deleteSetup(store, s.name);
                  setSaved(loadSetups(store));
                }}
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
      <button
        type="button"
        className="primary"
        disabled={errors.length > 0}
        onClick={() => onDone(pieces)}
      >
        {errors.length > 0 && toPlace > 0 ? `Place all ${total} pieces to continue` : doneLabel}
      </button>
    </section>
  );
}

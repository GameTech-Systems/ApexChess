import { useMemo, useState } from "react";
import { setupArea, type Pieces, type Position, type ResolvedRuleset } from "@apexchess/engine";
import { Board } from "./Board";
import { clearSquare, placePiece, remaining, setupErrors } from "./setupBuilder";
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
}

/** Held piece: picked from the tray (no `from`) or lifted off a square. */
interface Held {
  piece: string;
  from?: string;
}

export function SetupBuilder({ ruleset, title, presets, store, onDone }: Props) {
  const [pieces, setPieces] = useState<Pieces>({});
  const [held, setHeld] = useState<Held>();
  const [saved, setSaved] = useState(() => loadSetups(store));
  const [name, setName] = useState("");

  const area = useMemo(() => setupArea(ruleset), [ruleset]);
  const left = remaining(ruleset, pieces);
  const errors = setupErrors(ruleset, pieces);
  const position: Position = {
    squares: Object.fromEntries(
      Object.entries(pieces).map(([sq, piece]) => [sq, { side: "light" as const, piece }]),
    ),
    turn: "light",
    ply: 0,
    unmoved: [],
  };

  const onSquareClick = (square: string) => {
    if (!area.includes(square)) return setHeld(undefined);
    if (held) {
      setPieces(placePiece(ruleset, pieces, square, held.piece, held.from));
      return setHeld(undefined);
    }
    const piece = pieces[square];
    setHeld(piece ? { piece, from: square } : undefined);
  };

  const load = (next: Pieces) => {
    setPieces({ ...next });
    setHeld(undefined);
  };

  return (
    <section aria-label="Setup builder">
      <h2>{title}</h2>
      <Board
        board={ruleset.board}
        position={position}
        view="light"
        pieceSet={ruleset.pieces}
        onSquareClick={onSquareClick}
        selected={held?.from}
        targets={held ? new Set(area) : undefined}
      />
      <div role="group" aria-label="Pieces to place" className="tray">
        {Object.keys(ruleset.army).map((piece) => (
          <button
            key={piece}
            type="button"
            aria-pressed={held?.piece === piece && !held.from}
            disabled={left[piece] === 0}
            onClick={() => setHeld({ piece })}
          >
            {piece} ×{left[piece]}
          </button>
        ))}
        <button
          type="button"
          disabled={!held?.from}
          onClick={() => {
            setPieces(clearSquare(pieces, held!.from!));
            setHeld(undefined);
          }}
        >
          Remove
        </button>
        <button type="button" onClick={() => load({})}>
          Clear
        </button>
      </div>
      <ul role="status" aria-label="Setup problems" className="errors">
        {errors.map((e) => (
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
      <button type="button" disabled={errors.length > 0} onClick={() => onDone(pieces)}>
        Done
      </button>
    </section>
  );
}

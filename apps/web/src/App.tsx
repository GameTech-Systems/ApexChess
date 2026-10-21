import { useMemo, useState } from "react";
import {
  addMove,
  catalog,
  inCheck,
  legalMoves,
  newRecord,
  replay,
  resolveRuleset,
  result,
  type GameRecord,
  type Move,
  type Side,
} from "@apexchess/engine";
import { Board } from "./Board";
import {
  DEFAULT_DARK_SQUARE,
  darkSquareColors,
  promotionChoices,
  targetsFrom,
  type DarkSquareColor,
} from "./hotseat";
import "./board.css";

const ruleset = resolveRuleset(catalog, "standard");
// D14: hot-seat setups are hidden until both are built, so both sides use the default.
const setup = ruleset.setup.default.pieces;

function describe(res: ReturnType<typeof result>): string {
  if (res.status === "checkmate") return `Checkmate. ${res.winner} wins.`;
  if (res.status === "draw") return `Draw by ${res.reason}.`;
  return "";
}

export function App() {
  const [record, setRecord] = useState<GameRecord>(() => newRecord(ruleset, setup, setup));
  // D15: players alternate sides on rematch, so the first mover's seat alternates in the log.
  const [games, setGames] = useState(0);
  const [selected, setSelected] = useState<string>();
  const [pending, setPending] = useState<{ from: string; to: string; choices: string[] }>();
  const [dark, setDark] = useState<DarkSquareColor>(DEFAULT_DARK_SQUARE);
  const [flip, setFlip] = useState(true);

  const game = useMemo(() => replay(ruleset, record), [record]);
  const res = result(ruleset, game);
  const pos = game.position;
  const moves = useMemo(() => legalMoves(ruleset, pos), [pos]);
  const over = res.status !== "ongoing";
  const view: Side = flip ? pos.turn : "light";
  const targets = selected ? targetsFrom(moves, selected) : undefined;
  const last = record.moves.at(-1);
  const lastMove = last ? [last.slice(0, 2), last.slice(3, 5)] : undefined;
  const checked = inCheck(ruleset, pos)
    ? Object.entries(pos.squares).find(
        ([, p]) => p.side === pos.turn && ruleset.pieces.pieces[p.piece]?.royal,
      )?.[0]
    : undefined;

  const commit = (move: Move) => {
    setRecord(addMove(ruleset, record, move));
    setSelected(undefined);
    setPending(undefined);
  };

  const onSquareClick = (square: string) => {
    if (over || pending) return;
    if (selected && targets?.has(square)) {
      const choices = promotionChoices(moves, selected, square);
      if (choices.length) return setPending({ from: selected, to: square, choices });
      return commit(moves.find((m) => m.from === selected && m.to === square)!);
    }
    const own = pos.squares[square]?.side === pos.turn && moves.some((m) => m.from === square);
    setSelected(own && square !== selected ? square : undefined);
  };

  const rematch = () => {
    setRecord(newRecord(ruleset, setup, setup));
    setGames(games + 1);
    setSelected(undefined);
    setPending(undefined);
  };

  return (
    <main style={{ "--sq-dark": darkSquareColors[dark] } as React.CSSProperties}>
      <Board
        board={ruleset.board}
        position={pos}
        view={view}
        pieceSet={ruleset.pieces}
        onSquareClick={onSquareClick}
        selected={selected}
        targets={targets}
        lastMove={lastMove}
        checked={checked}
      />
      <p role="status" className="status">
        {over ? describe(res) : `${pos.turn} to move${checked ? " (check)" : ""}`}
      </p>
      {pending && (
        <div role="group" aria-label="Promote to" className="promo">
          {pending.choices.map((piece) => (
            <button
              key={piece}
              type="button"
              onClick={() =>
                commit(
                  moves.find(
                    (m) => m.from === pending.from && m.to === pending.to && m.promotion === piece,
                  )!,
                )
              }
            >
              {piece}
            </button>
          ))}
        </div>
      )}
      <div className="controls">
        <button type="button" onClick={rematch}>
          {over ? `Rematch (game ${games + 2})` : "New game"}
        </button>
        <label>
          <input type="checkbox" checked={flip} onChange={(e) => setFlip(e.target.checked)} /> Turn
          the board each move
        </label>
        <label>
          Dark squares{" "}
          <select value={dark} onChange={(e) => setDark(e.target.value as DarkSquareColor)}>
            {Object.keys(darkSquareColors).map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <ol className="moves" aria-label="Moves">
        {record.moves.map((text, i) => (
          <li key={i}>{text}</li>
        ))}
      </ol>
    </main>
  );
}

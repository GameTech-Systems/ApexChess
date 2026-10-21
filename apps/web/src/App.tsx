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
  type Pieces,
  type Move,
  type Side,
} from "@apexchess/engine";
import { Board } from "./Board";
import { SetupBuilder } from "./SetupBuilder";
import { seatOf, setupsForGame } from "./seats";
import {
  DEFAULT_DARK_SQUARE,
  darkSquareColors,
  promotionChoices,
  targetsFrom,
  type DarkSquareColor,
} from "./hotseat";
import "./board.css";

const ruleset = resolveRuleset(catalog, "standard");
const presets = catalog.setups
  .filter((s) => s.status === "official")
  .map((s) => ({ name: s.name, pieces: s.pieces }));
const store = (() => {
  try {
    return window.localStorage;
  } catch {
    return { getItem: () => null, setItem: () => undefined };
  }
})();

function describe(res: ReturnType<typeof result>): string {
  if (res.status === "checkmate") return `Checkmate. ${res.winner} wins.`;
  if (res.status === "draw") return `Draw by ${res.reason}.`;
  return "";
}

/** D14: each player builds a setup while the other looks away; both are revealed at the start. */
export function App() {
  const [built, setBuilt] = useState<Pieces[]>([]);
  if (built.length < 2) {
    const player = built.length + 1;
    return (
      <main>
        <SetupBuilder
          key={player}
          ruleset={ruleset}
          title={`Player ${player}: build your setup${player === 2 ? " (Player 1, look away)" : " (Player 2, look away)"}`}
          presets={presets}
          store={store}
          onDone={(pieces) => setBuilt([...built, pieces])}
        />
      </main>
    );
  }
  return <Game setups={[built[0]!, built[1]!]} onChangeSetups={() => setBuilt([])} />;
}

export function Game({
  setups,
  onChangeSetups,
}: {
  setups: readonly [Pieces, Pieces];
  onChangeSetups: () => void;
}) {
  // D15: players alternate sides on rematch; `games` counts finished-or-abandoned games.
  const [games, setGames] = useState(0);
  const start = (n: number) => {
    const { light, dark } = setupsForGame(setups, n);
    return newRecord(ruleset, light, dark);
  };
  const [record, setRecord] = useState<GameRecord>(() => start(0));
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
    const next = over ? games + 1 : games;
    setRecord(start(next));
    setGames(next);
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
      <p className="seats">
        Player 1 plays {seatOf(0, games)}, Player 2 plays {seatOf(1, games)}.
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
          {over ? `Rematch (game ${games + 2})` : "Restart"}
        </button>
        <button type="button" onClick={onChangeSetups}>
          New setups
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

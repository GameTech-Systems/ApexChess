import { useEffect, useMemo, useRef, useState } from "react";
import {
  addMove,
  catalog,
  chooseSetup,
  inCheck,
  legalMoves,
  newRecord,
  replay,
  resolveRuleset,
  result,
  seededRandom,
  type GameRecord,
  type Pieces,
  type Move,
  type Side,
} from "@apexchess/engine";
import { Board } from "./Board";
import { Privacy } from "./Privacy";
import { Rules } from "./Rules";
import { piecesInDanger, playSound, undoMoves } from "./playAids";
import { SetupBuilder } from "./SetupBuilder";
import { DEFAULT_LEVEL, computerMove, levels, type Level } from "./computer";
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

/** Seeds differ per game; the engine stays deterministic for a given seed. */
const newRandom = () => seededRandom(Math.floor(Math.random() * 2 ** 32));

type Mode = "hotseat" | "computer";

export function App({ initialMode }: { initialMode?: Mode }) {
  const [mode, setMode] = useState(initialMode);
  const [level, setLevel] = useState<Level>(DEFAULT_LEVEL);
  const [showRules, setShowRules] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  if (showRules)
    return (
      <main>
        <Rules onClose={() => setShowRules(false)} />
      </main>
    );
  if (showPrivacy)
    return (
      <main>
        <Privacy onClose={() => setShowPrivacy(false)} />
      </main>
    );
  if (!mode) {
    return (
      <main>
        <section aria-label="Choose an opponent" className="controls">
          <button type="button" onClick={() => setMode("hotseat")}>
            Two players
          </button>
          <button type="button" onClick={() => setMode("computer")}>
            Play the computer
          </button>
          <label>
            Computer{" "}
            <select value={level} onChange={(e) => setLevel(e.target.value as Level)}>
              {Object.entries(levels).map(([id, l]) => (
                <option key={id} value={id}>
                  {l.label}
                </option>
              ))}
            </select>
          </label>
          <button type="button" onClick={() => setShowRules(true)}>
            Rules
          </button>
          <button type="button" onClick={() => setShowPrivacy(true)}>
            Privacy
          </button>
        </section>
      </main>
    );
  }
  return mode === "computer" ? (
    <VsComputer level={level} onChangeSetups={() => setMode(undefined)} />
  ) : (
    <HotSeat />
  );
}

/** The player builds a setup; the computer picks a legal preset, revealed when the game starts. */
function VsComputer({ level, onChangeSetups }: { level: Level; onChangeSetups: () => void }) {
  const [setups, setSetups] = useState<[Pieces, Pieces]>();
  if (!setups) {
    return (
      <main>
        <SetupBuilder
          ruleset={ruleset}
          title="Build your setup"
          presets={presets}
          store={store}
          onDone={(pieces) =>
            setSetups([
              pieces,
              chooseSetup(
                ruleset,
                presets.map((p) => p.pieces),
                newRandom(),
              ),
            ])
          }
        />
      </main>
    );
  }
  return <Game setups={setups} onChangeSetups={onChangeSetups} computer={level} />;
}

/** D14: each player builds a setup while the other looks away; both are revealed at the start. */
function HotSeat() {
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

/** With `computer`, Player 2 is the computer at that level. */
export function Game({
  setups,
  onChangeSetups,
  computer,
}: {
  setups: readonly [Pieces, Pieces];
  onChangeSetups: () => void;
  computer?: Level;
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
  const [showMoves, setShowMoves] = useState(true);
  const [showDanger, setShowDanger] = useState(false);
  const [sound, setSound] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const random = useMemo(newRandom, []);

  const game = useMemo(() => replay(ruleset, record), [record]);
  const res = result(ruleset, game);
  const pos = game.position;
  const moves = useMemo(() => legalMoves(ruleset, pos), [pos]);
  const over = res.status !== "ongoing";
  const computerSide = computer ? seatOf(1, games) : undefined;
  const computerTurn = !over && pos.turn === computerSide;
  const view: Side = computer ? seatOf(0, games) : flip ? pos.turn : "light";
  const targets = selected && showMoves ? targetsFrom(moves, selected) : undefined;
  const danger = useMemo(
    () => (showDanger ? piecesInDanger(ruleset, pos, view) : undefined),
    [showDanger, pos, view],
  );
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

  const moveCount = record.moves.length;
  const lastCapture = useRef(false);
  lastCapture.current = Object.keys(pos.squares).length < 32;
  const prevCount = useRef(moveCount);
  useEffect(() => {
    if (sound && moveCount > prevCount.current)
      playSound(over ? "end" : lastCapture.current ? "capture" : "move");
    prevCount.current = moveCount;
  }, [moveCount, sound, over]);

  // The short delay lets the player's move render before the search runs.
  useEffect(() => {
    if (!computerTurn) return;
    const timer = setTimeout(() => {
      const move = computerMove(ruleset, game, computer!, random);
      if (move) setRecord((r) => addMove(ruleset, r, move));
    }, 250);
    return () => clearTimeout(timer);
  }, [computerTurn, game, computer, random]);

  const onSquareClick = (square: string) => {
    if (over || pending || computerTurn) return;
    if (selected && targets?.has(square)) {
      const choices = promotionChoices(moves, selected, square);
      if (choices.length) return setPending({ from: selected, to: square, choices });
      return commit(moves.find((m) => m.from === selected && m.to === square)!);
    }
    const own = pos.squares[square]?.side === pos.turn && moves.some((m) => m.from === square);
    setSelected(own && square !== selected ? square : undefined);
  };

  // Online play will not offer undo; here it takes back the last move (and the computer's reply).
  const undo = () => {
    setRecord(undoMoves(record, computer ? (computerSide === "light" ? 1 : 0) : undefined));
    setSelected(undefined);
    setPending(undefined);
  };

  const rematch = () => {
    const next = over ? games + 1 : games;
    setRecord(start(next));
    setGames(next);
    setSelected(undefined);
    setPending(undefined);
  };

  if (showRules)
    return (
      <main>
        <Rules onClose={() => setShowRules(false)} />
      </main>
    );

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
        danger={danger}
      />
      <p role="status" className="status">
        {over
          ? describe(res)
          : `${pos.turn} to move${checked ? " (check)" : ""}${computerTurn ? ", computer thinking" : ""}`}
      </p>
      <p className="seats">
        {computer
          ? `You play ${seatOf(0, games)}, the computer (${levels[computer].label}) plays ${seatOf(1, games)}.`
          : `Player 1 plays ${seatOf(0, games)}, Player 2 plays ${seatOf(1, games)}.`}
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
        <button type="button" onClick={undo} disabled={record.moves.length === 0 || computerTurn}>
          Undo
        </button>
        <button type="button" onClick={onChangeSetups}>
          New setups
        </button>
        <button type="button" onClick={() => setShowRules(true)}>
          Rules
        </button>
        {!computer && (
          <label>
            <input type="checkbox" checked={flip} onChange={(e) => setFlip(e.target.checked)} />{" "}
            Turn the board each move
          </label>
        )}
        <label>
          <input
            type="checkbox"
            checked={showMoves}
            onChange={(e) => setShowMoves(e.target.checked)}
          />{" "}
          Show legal moves
        </label>
        <label>
          <input
            type="checkbox"
            checked={showDanger}
            onChange={(e) => setShowDanger(e.target.checked)}
          />{" "}
          Show pieces in danger
        </label>
        <label>
          <input type="checkbox" checked={sound} onChange={(e) => setSound(e.target.checked)} />{" "}
          Sound
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

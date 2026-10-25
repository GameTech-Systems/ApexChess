import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
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
import { Account } from "./Account";
import { Board } from "./Board";
import { Events } from "./Event";
import { parseEventHash } from "./event";
import { Home, type Opponent, type Panel, type SetupChoice } from "./Home";
import { Logo } from "./Logo";
import { MoveList } from "./MoveList";
import { Online } from "./Online";
import { loadTicket, saveTicket } from "./online";
import type { KeyValueStore } from "./savedSetups";
import { Privacy } from "./Privacy";
import { Replay } from "./Replay";
import { Rules } from "./Rules";
import { copyText, gameLink, parseShare } from "./share";
import { Leaderboard } from "./Leaderboard";
import { Stats } from "./Stats";
import { Terms } from "./Terms";
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
const current = { id: ruleset.id, version: ruleset.version };
const presets = catalog.setups
  .filter((s) => s.status === "official")
  .map((s) => ({ name: s.name, pieces: s.pieces }));
const defaultSetup = ruleset.setup.default.pieces;
const store = (() => {
  try {
    return window.localStorage;
  } catch {
    return { getItem: () => null, setItem: () => undefined };
  }
})();

/** Public source repository and the build's third-party license file (see NOTICE). */
const SOURCE_URL = "https://github.com/GameTech-Systems/ApexChess";
const LICENSES_URL = "/third-party-licenses.txt";

function describe(res: ReturnType<typeof result>): string {
  if (res.status === "checkmate") return `Checkmate. ${res.winner} wins.`;
  if (res.status === "draw") return `Draw by ${res.reason}.`;
  return "";
}

/** Seeds differ per game; the engine stays deterministic for a given seed. */
const newRandom = () => seededRandom(Math.floor(Math.random() * 2 ** 32));

type Mode = Opponent;

/** `storage` is this device's store; tests pass their own. */
export function App({
  initialMode,
  initialSetup = "custom",
  storage = store,
}: {
  initialMode?: Mode;
  initialSetup?: SetupChoice;
  storage?: KeyValueStore;
}) {
  // A saved room ticket means a game in progress: go straight back to it.
  const [mode, setMode] = useState(
    () => initialMode ?? (loadTicket(storage) ? "online" : undefined),
  );
  const [setupChoice, setSetupChoice] = useState<SetupChoice>(initialSetup);
  const [level, setLevel] = useState<Level>(DEFAULT_LEVEL);
  // Pages opened over the current view; closing one goes back to what was under it.
  const [panels, setPanels] = useState<Panel[]>([]);
  // Bumped by Home so everything below starts over.
  const [round, setRound] = useState(0);
  const busy = useRef<string>();
  const setBusy = useCallback((why: string | undefined) => {
    busy.current = why;
  }, []);
  // A share link opens straight to its setup or replay; the fragment never reaches the server.
  const [shared, setShared] = useState(() =>
    parseShare(ruleset, typeof window === "undefined" ? "" : window.location.hash),
  );
  // An event link (D20) opens its event page; `{}` is the tournaments start screen.
  const [events, setEvents] = useState<{ code?: string } | undefined>(() => {
    const code = parseEventHash(typeof window === "undefined" ? "" : window.location.hash);
    return code ? { code } : undefined;
  });
  const clearHash = () => {
    if (window.location.hash)
      history.replaceState(null, "", window.location.pathname + window.location.search);
  };
  const closeShared = () => {
    clearHash();
    setShared(undefined);
  };
  const open = (panel: Panel) => setPanels((p) => [...p.filter((x) => x !== panel), panel]);
  const close = () => setPanels((p) => p.slice(0, -1));
  const panel = panels.at(-1);

  const goHome = (e?: MouseEvent) => {
    e?.preventDefault();
    const online = mode === "online" && loadTicket(storage);
    const warning = online
      ? "Your online game keeps going while you are away. Go to the home page? You can rejoin from Play online."
      : busy.current;
    if (warning && !window.confirm(warning)) return;
    clearHash();
    busy.current = undefined;
    setShared(undefined);
    setEvents(undefined);
    setPanels([]);
    setMode(undefined);
    setRound((n) => n + 1);
  };

  const view = shared ? `shared-${shared.kind}` : events ? "events" : (mode ?? "home");
  // Each new page starts at the top.
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [view, panel, round]);

  let content;
  if (shared?.kind === "game")
    content = (
      <main>
        <Replay ruleset={ruleset} record={shared.record} onClose={closeShared} />
      </main>
    );
  else if (shared?.kind === "setup")
    content = (
      <main>
        <SetupBuilder
          ruleset={ruleset}
          title="Shared setup"
          presets={presets}
          store={storage}
          initial={shared.pieces}
          onDone={closeShared}
        />
      </main>
    );
  else if (events)
    content = (
      <Events
        initial={events.code}
        ruleset={ruleset}
        store={storage}
        onPlay={(ticket) => {
          // The game takes over the page; a reload rejoins it from the saved ticket.
          clearHash();
          saveTicket(storage, ticket);
          setEvents(undefined);
          setMode("online");
        }}
        onExit={() => setEvents(undefined)}
      />
    );
  else if (!mode)
    content = (
      <main className="wide">
        <Home
          ruleset={ruleset}
          initialLevel={level}
          onStart={(opponent, setup, lvl) => {
            setSetupChoice(setup);
            setLevel(lvl);
            setMode(opponent);
          }}
          onOpen={open}
          onEvents={() => setEvents({})}
        />
      </main>
    );
  else if (mode === "online")
    content = (
      <Online
        ruleset={ruleset}
        presets={presets}
        store={storage}
        setup={setupChoice === "default" ? defaultSetup : undefined}
        onExit={() => setMode(undefined)}
        onEvent={(code) => {
          setMode(undefined);
          setEvents({ code });
        }}
      />
    );
  else
    content =
      mode === "computer" ? (
        <VsComputer
          level={level}
          useDefault={setupChoice === "default"}
          onChangeSetups={() => setMode(undefined)}
          onBusy={setBusy}
        />
      ) : (
        <HotSeat useDefault={setupChoice === "default"} onBusy={setBusy} />
      );

  let page;
  if (panel === "rules") page = <Rules ruleset={ruleset} onClose={close} />;
  else if (panel === "privacy") page = <Privacy onClose={close} />;
  else if (panel === "terms") page = <Terms onClose={close} />;
  else if (panel === "stats") page = <Stats onClose={close} current={current} />;
  else if (panel === "leaderboard") page = <Leaderboard onClose={close} />;
  else if (panel === "account")
    page = <Account store={storage} onClose={close} onTerms={() => open("terms")} />;

  return (
    <>
      <a className="skip" href="#content">
        Skip to content
      </a>
      <header className="topbar">
        <a className="brand" href="/" onClick={goHome} aria-label="Apex Chess home">
          <Logo size={34} />
          <span>Apex Chess</span>
        </a>
        <nav aria-label="Site">
          <a href="/" onClick={goHome}>
            Home
          </a>
          <button type="button" className="link" onClick={() => open("rules")}>
            Rules
          </button>
        </nav>
      </header>
      <div id="content" className="view" key={`${view}-${round}`} hidden={Boolean(page)}>
        {content}
      </div>
      {page && (
        <div className="view" key={`panel-${panel}`}>
          {panel === "account" ? page : <main>{page}</main>}
        </div>
      )}
      <footer className="site-footer">
        <nav aria-label="About">
          <button type="button" className="link" onClick={() => open("rules")}>
            Rules
          </button>
          <button type="button" className="link" onClick={() => open("privacy")}>
            Privacy
          </button>
          <button type="button" className="link" onClick={() => open("terms")}>
            Terms
          </button>
          <a href={LICENSES_URL}>Third-party licenses</a>
          <a href={SOURCE_URL} rel="noopener noreferrer" target="_blank">
            Source code
          </a>
        </nav>
        <p>
          © 2026 Duke Johnson. Apex Chess™ and the turned-board logo are trademarks of Duke Johnson.
          The code and rules are source-available under the PolyForm Shield License 1.0.0; they are
          not open source.
        </p>
      </footer>
    </>
  );
}

/** The player builds a setup (or takes the default); the computer picks a legal preset, revealed when the game starts. */
function VsComputer({
  level,
  useDefault,
  onChangeSetups,
  onBusy,
}: {
  level: Level;
  useDefault?: boolean;
  onChangeSetups: () => void;
  onBusy?: (why: string | undefined) => void;
}) {
  const computerSetup = () =>
    chooseSetup(
      ruleset,
      presets.map((p) => p.pieces),
      newRandom(),
    );
  const [setups, setSetups] = useState<[Pieces, Pieces] | undefined>(() =>
    useDefault ? [defaultSetup, computerSetup()] : undefined,
  );
  if (!setups) {
    return (
      <main>
        <SetupBuilder
          ruleset={ruleset}
          title="Build your setup"
          presets={presets}
          store={store}
          side={seatOf(0, 0)}
          doneLabel="Start the game"
          onDone={(pieces) => setSetups([pieces, computerSetup()])}
        />
      </main>
    );
  }
  return (
    <Game
      setups={setups}
      onChangeSetups={useDefault ? () => setSetups(undefined) : onChangeSetups}
      computer={level}
      onBusy={onBusy}
    />
  );
}

/** D14: each player builds a setup from their own seat while the other looks away; both are revealed at the start. */
function HotSeat({
  useDefault,
  onBusy,
}: {
  useDefault?: boolean;
  onBusy?: (why: string | undefined) => void;
}) {
  const [built, setBuilt] = useState<Pieces[]>(() =>
    useDefault ? [defaultSetup, defaultSetup] : [],
  );
  if (built.length < 2) {
    const player = built.length as 0 | 1;
    const side = seatOf(player, 0);
    return (
      <main>
        <SetupBuilder
          key={player}
          ruleset={ruleset}
          title={`Player ${player + 1}: build your setup (Player ${player === 0 ? 2 : 1}, look away)`}
          hint={`Player ${player + 1} plays ${side} in the first game. The board is shown from your seat, with your own coordinates.`}
          presets={presets}
          store={store}
          side={side}
          doneLabel={player === 0 ? "Done: hand over to Player 2" : "Start the game"}
          onDone={(pieces) => setBuilt([...built, pieces])}
        />
      </main>
    );
  }
  return (
    <Game setups={[built[0]!, built[1]!]} onChangeSetups={() => setBuilt([])} onBusy={onBusy} />
  );
}

/** With `computer`, Player 2 is the computer at that level. */
export function Game({
  setups,
  onChangeSetups,
  computer,
  onBusy,
}: {
  setups: readonly [Pieces, Pieces];
  onChangeSetups: () => void;
  computer?: Level;
  /** Told when leaving would lose a game in progress (a reason), and when it would not. */
  onBusy?: (why: string | undefined) => void;
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
  const [showReplay, setShowReplay] = useState(false);
  const [copied, setCopied] = useState(false);
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
  const inProgress = moveCount > 0 && !over;
  useEffect(() => {
    onBusy?.(inProgress ? "Leave this game? It is not saved." : undefined);
  }, [inProgress, onBusy]);
  useEffect(() => () => onBusy?.(undefined), [onBusy]);

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
        <Rules ruleset={ruleset} onClose={() => setShowRules(false)} />
      </main>
    );

  if (showReplay)
    return (
      <main>
        <Replay ruleset={ruleset} record={record} onClose={() => setShowReplay(false)} />
      </main>
    );

  return (
    <main className="game" style={{ "--sq-dark": darkSquareColors[dark] } as React.CSSProperties}>
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
      <div className="game-side">
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
                      (m) =>
                        m.from === pending.from && m.to === pending.to && m.promotion === piece,
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
          <button type="button" onClick={() => setShowReplay(true)} disabled={!record.moves.length}>
            Replay
          </button>
          <button
            type="button"
            disabled={!record.moves.length}
            onClick={async () => {
              const url = location.origin + location.pathname + gameLink(ruleset, record);
              setCopied(await copyText(url));
            }}
          >
            {copied ? "Link copied" : "Copy game link"}
          </button>
        </div>
        <div className="controls toggles">
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
        <h2 className="moves-title">Moves</h2>
        <MoveList moves={record.moves} first={ruleset.firstToMove} />
      </div>
    </main>
  );
}

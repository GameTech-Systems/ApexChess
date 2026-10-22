import { useEffect, useMemo, useRef, useState } from "react";
import {
  inCheck,
  legalMoves,
  moveText,
  type GameRecord,
  type Move,
  type Pieces,
  type ResolvedRuleset,
} from "@apexchess/engine";
import {
  follow,
  type ClientMessage,
  type Lock,
  type RoomView,
  type Ticket,
} from "@apexchess/online";
import { Board } from "./Board";
import { SetupBuilder, type Preset } from "./SetupBuilder";
import { promotionChoices, targetsFrom } from "./hotseat";
import {
  apiUrl,
  clearTicket,
  endText,
  loadTicket,
  lockFor,
  parseServerMessage,
  reconnectDelay,
  requestTicket,
  saveTicket,
} from "./online";
import type { KeyValueStore } from "./savedSetups";

interface Props {
  ruleset: ResolvedRuleset;
  presets: Preset[];
  store: KeyValueStore;
  onExit: () => void;
}

/** Online play: lock a setup (D13), find an opponent, play. A saved ticket rejoins the room after a reload. */
export function Online({ ruleset, presets, store, onExit }: Props) {
  const [ticket, setTicket] = useState(() => loadTicket(store));
  const [setup, setSetup] = useState<Pieces>();
  const [notice, setNotice] = useState<string>();
  if (ticket)
    return (
      <OnlineRoom
        ticket={ticket}
        ruleset={ruleset}
        onLeave={(why) => {
          clearTicket(store);
          setTicket(undefined);
          setNotice(why);
        }}
      />
    );
  if (!setup)
    return (
      <main>
        <SetupBuilder
          ruleset={ruleset}
          title="Lock your setup for online play. Your opponent sees it only when the game starts."
          presets={presets}
          store={store}
          onDone={setSetup}
        />
        <button type="button" onClick={onExit}>
          Back
        </button>
      </main>
    );
  return (
    <OnlineLobby
      lock={lockFor(ruleset, setup)}
      notice={notice}
      onTicket={(t) => {
        saveTicket(store, t);
        setTicket(t);
      }}
      onChangeSetup={() => setSetup(undefined)}
      onExit={onExit}
    />
  );
}

function OnlineLobby({
  lock,
  notice,
  onTicket,
  onChangeSetup,
  onExit,
}: {
  lock: Lock;
  notice?: string;
  onTicket: (t: Ticket) => void;
  onChangeSetup: () => void;
  onExit: () => void;
}) {
  const [code, setCode] = useState("");
  const [error, setError] = useState(notice);
  const [busy, setBusy] = useState(false);
  const [seeking, setSeeking] = useState<WebSocket>();
  useEffect(() => () => seeking?.close(), [seeking]);

  const post = (path: string) => {
    setBusy(true);
    setError(undefined);
    requestTicket(fetch, apiUrl(location, path), lock)
      .then(onTicket)
      .catch((e: Error) => setError(e.message))
      .finally(() => setBusy(false));
  };

  const quickMatch = () => {
    setError(undefined);
    const ws = new WebSocket(apiUrl(location, "/api/match", true));
    ws.onopen = () => ws.send(JSON.stringify({ type: "seek", ...lock }));
    ws.onmessage = (e) => {
      const msg = parseServerMessage(String(e.data));
      if (msg?.type === "matched") onTicket({ room: msg.room, token: msg.token });
      if (msg?.type === "error") setError(msg.message);
    };
    ws.onclose = () => setSeeking(undefined);
    ws.onerror = () => setError("Could not reach the server. Check your connection and try again.");
    setSeeking(ws);
  };

  return (
    <main>
      <section aria-label="Play online" className="controls">
        <h1>Play online</h1>
        <p>Your setup is locked. Pick how to find an opponent.</p>
        {seeking ? (
          <>
            <p role="status">Looking for an opponent…</p>
            <button type="button" onClick={() => seeking.close()}>
              Cancel
            </button>
          </>
        ) : (
          <>
            <button type="button" onClick={quickMatch} disabled={busy}>
              Quick match
            </button>
            <button type="button" onClick={() => post("/api/rooms")} disabled={busy}>
              Create a private room
            </button>
            <label>
              Room code{" "}
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                maxLength={6}
                autoCapitalize="characters"
                spellCheck={false}
              />
            </label>
            <button
              type="button"
              onClick={() => post(`/api/rooms/${encodeURIComponent(code.trim())}/join`)}
              disabled={busy || code.trim().length !== 6}
            >
              Join
            </button>
            <button type="button" onClick={onChangeSetup}>
              Change setup
            </button>
            <button type="button" onClick={onExit}>
              Back
            </button>
          </>
        )}
        {error && <p role="alert">{error}</p>}
      </section>
    </main>
  );
}

/** Close codes from the server that mean "don't reconnect". */
const FINAL: Record<number, string> = {
  4000: "This game is no longer available.",
  4001: "This game was opened in another tab or device.",
  4002: "This room has expired.",
};

/** Keeps a socket to the room open, reconnecting with backoff; the server resends the whole game. */
function OnlineRoom({
  ticket,
  ruleset,
  onLeave,
}: {
  ticket: Ticket;
  ruleset: ResolvedRuleset;
  onLeave: (why?: string) => void;
}) {
  const [view, setView] = useState<RoomView>();
  const [error, setError] = useState<string>();
  const [connected, setConnected] = useState(false);
  const socket = useRef<WebSocket>();
  const leave = useRef(onLeave);
  leave.current = onLeave;

  useEffect(() => {
    let attempt = 0;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const open = () => {
      const path = `/api/rooms/${ticket.room}/socket?token=${encodeURIComponent(ticket.token)}`;
      const ws = new WebSocket(apiUrl(location, path, true));
      socket.current = ws;
      ws.onopen = () => {
        attempt = 0;
        setConnected(true);
      };
      ws.onmessage = (e) => {
        const msg = parseServerMessage(String(e.data));
        if (msg?.type === "state") {
          setView(msg);
          setError(undefined);
        } else if (msg?.type === "error") setError(msg.message);
      };
      ws.onclose = (e) => {
        setConnected(false);
        if (stopped) return;
        if (FINAL[e.code]) {
          stopped = true;
          leave.current(FINAL[e.code]);
        } else timer = setTimeout(open, reconnectDelay(attempt++));
      };
    };
    open();
    return () => {
      stopped = true;
      clearTimeout(timer);
      socket.current?.close();
    };
  }, [ticket]);

  const send = (msg: ClientMessage) => {
    if (socket.current?.readyState === WebSocket.OPEN) socket.current.send(JSON.stringify(msg));
  };

  return (
    <>
      {!connected && <p role="status">Connecting to the game server…</p>}
      {error && <p role="alert">{error}</p>}
      {view?.phase === "waiting" ? (
        <RoomWaiting room={view.room} onLeave={() => onLeave()} />
      ) : view ? (
        <OnlineGame view={view} ruleset={ruleset} send={send} onLeave={() => onLeave()} />
      ) : null}
    </>
  );
}

export function RoomWaiting({ room, onLeave }: { room: string; onLeave: () => void }) {
  return (
    <main>
      <section aria-label="Waiting for your opponent" className="controls">
        <h1>Room {room}</h1>
        <p>
          Give this code to your opponent. Both setups stay hidden until the game starts; then a
          coin flip decides who plays light.
        </p>
        <button type="button" onClick={onLeave}>
          Leave room
        </button>
      </section>
    </main>
  );
}

/** The game as the server reports it. Moves go to the server; there is no undo online. */
export function OnlineGame({
  view,
  ruleset,
  send,
  onLeave,
}: {
  view: RoomView;
  ruleset: ResolvedRuleset;
  send: (msg: ClientMessage) => void;
  onLeave: () => void;
}) {
  const record = view.record!;
  const side = view.side!;
  const prev = useRef<GameRecord>();
  const game = useMemo(() => follow(ruleset, record, prev.current), [ruleset, record]);
  prev.current = record;
  const pos = game.position;
  const moves = useMemo(() => legalMoves(ruleset, pos), [ruleset, pos]);
  const [selected, setSelected] = useState<string>();
  const [pending, setPending] = useState<{ from: string; to: string; choices: string[] }>();
  const [showMoves, setShowMoves] = useState(true);
  const [confirmResign, setConfirmResign] = useState(false);
  useEffect(() => {
    setSelected(undefined);
    setPending(undefined);
    setConfirmResign(false);
  }, [record]);

  const over = view.phase === "over";
  const yourTurn = !over && pos.turn === side;
  const targets = selected && showMoves ? targetsFrom(moves, selected) : undefined;
  const last = record.moves.at(-1);
  const lastMove = last ? [last.slice(0, 2), last.slice(3, 5)] : undefined;
  const checked = inCheck(ruleset, pos)
    ? Object.entries(pos.squares).find(
        ([, p]) => p.side === pos.turn && ruleset.pieces.pieces[p.piece]?.royal,
      )?.[0]
    : undefined;

  const commit = (move: Move) => {
    send({ type: "move", move: moveText(move), ply: record.moves.length });
    setSelected(undefined);
    setPending(undefined);
  };

  const onSquareClick = (square: string) => {
    if (!yourTurn || pending) return;
    if (selected && targetsFrom(moves, selected).has(square)) {
      const choices = promotionChoices(moves, selected, square);
      if (choices.length) return setPending({ from: selected, to: square, choices });
      return commit(moves.find((m) => m.from === selected && m.to === square)!);
    }
    const own = pos.squares[square]?.side === side && moves.some((m) => m.from === square);
    setSelected(own && square !== selected ? square : undefined);
  };

  return (
    <main>
      <Board
        board={ruleset.board}
        position={pos}
        view={side}
        pieceSet={ruleset.pieces}
        onSquareClick={onSquareClick}
        selected={selected}
        targets={targets}
        lastMove={lastMove}
        checked={checked}
      />
      <p role="status" className="status">
        {view.end
          ? endText(view.end, side)
          : `${yourTurn ? "Your move" : "Your opponent's move"}${checked ? " (check)" : ""}.`}
        {!view.opponentOnline && " Your opponent is offline; the game waits for them."}
      </p>
      <p className="seats">
        You play {side}. Room {view.room}, game {view.game + 1}.
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
        {over ? (
          <>
            <button
              type="button"
              onClick={() => send({ type: "rematch" })}
              disabled={view.rematch.you}
            >
              {view.rematch.you ? "Rematch asked" : "Rematch (you switch sides)"}
            </button>
            {view.rematch.opponent && !view.rematch.you && <p>Your opponent wants a rematch.</p>}
          </>
        ) : (
          <>
            {confirmResign ? (
              <button type="button" onClick={() => send({ type: "resign" })}>
                Confirm: resign this game
              </button>
            ) : (
              <button type="button" onClick={() => setConfirmResign(true)}>
                Resign
              </button>
            )}
            {view.drawOffer === "opponent" ? (
              <>
                <button type="button" onClick={() => send({ type: "offerDraw" })}>
                  Accept draw
                </button>
                <button type="button" onClick={() => send({ type: "declineDraw" })}>
                  Decline
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => send({ type: "offerDraw" })}
                disabled={view.drawOffer === "you"}
              >
                {view.drawOffer === "you" ? "Draw offered" : "Offer a draw"}
              </button>
            )}
          </>
        )}
        <button type="button" onClick={onLeave}>
          Leave room
        </button>
        <label>
          <input
            type="checkbox"
            checked={showMoves}
            onChange={(e) => setShowMoves(e.target.checked)}
          />{" "}
          Show legal moves
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

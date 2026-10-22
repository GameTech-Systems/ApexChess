import { useEffect, useState } from "react";
import type { ResolvedRuleset } from "@apexchess/engine";
import {
  DEFAULT_TIME_CONTROL,
  EVENT_CONTROLS,
  EVENT_MIN,
  NAME_MAX,
  PROTOCOL,
  ROUND_ROBIN_MAX,
  crosstable,
  timeControl,
  type EventRequest,
  type EventView,
  type Played,
  type Ticket,
} from "@apexchess/online";
import { callApi, eventLink, loadEventToken, pointsText, saveEventToken } from "./event";
import { apiUrl } from "./online";
import type { KeyValueStore } from "./savedSetups";
import { copyText } from "./share";

/** How often an open event page asks for news. */
const POLL_MS = 10_000;

const tcLabel = (id: string) => timeControl(id)?.label ?? id;
const NAME_HINT =
  "Your name is shown only in this event and deleted with it. Don't use your real name.";

/** Create an event or open one by code. */
export function EventHome({
  onCreate,
  onOpen,
  onExit,
  busy,
  error,
}: {
  onCreate: (name: string, timeControl: string) => void;
  onOpen: (code: string) => void;
  onExit: () => void;
  busy?: boolean;
  error?: string;
}) {
  const [name, setName] = useState("");
  const [tc, setTc] = useState(DEFAULT_TIME_CONTROL);
  const [code, setCode] = useState("");
  return (
    <main>
      <section aria-label="Tournaments" className="controls">
        <h1>Tournaments</h1>
        <p>
          A private event for {EVENT_MIN} or more players: share its link, and everyone who has it
          can join until you start. Up to {ROUND_ROBIN_MAX} players play a round robin; more play a
          Swiss event. Each game you lock a new setup; the pairing decides who plays light.
        </p>
        <h2>Create an event</h2>
        <label>
          Your name{" "}
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={NAME_MAX} />
        </label>
        <label>
          Time control{" "}
          <select value={tc} onChange={(e) => setTc(e.target.value)}>
            {EVENT_CONTROLS.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <p>{NAME_HINT}</p>
        <button type="button" onClick={() => onCreate(name, tc)} disabled={busy || !name.trim()}>
          Create the event
        </button>
        <h2>Open an event</h2>
        <label>
          Event code{" "}
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
          onClick={() => onOpen(code.trim().toUpperCase())}
          disabled={code.trim().length !== 6}
        >
          Open
        </button>
        <button type="button" onClick={onExit}>
          Back
        </button>
        {error && <p role="alert">{error}</p>}
      </section>
    </main>
  );
}

const resultText = (score?: [number, number]) =>
  score ? `${pointsText(score[0])}–${pointsText(score[1])}` : "playing";

/** Players by rank: a points table for a round robin, rounds with opponents for Swiss. */
function Crosstable({ view }: { view: EventView }) {
  const finished = view.games.map((r) => r.filter((g) => g.score)) as Played[][];
  const cells = crosstable(view.players.length, finished);
  const order = view.standings.map((s) => s.player);
  const place = new Map(order.map((p, i) => [p, i + 1]));
  const roundRobin = view.format === "roundRobin";
  return (
    <table className="crosstable" aria-label="Crosstable">
      <caption>Crosstable</caption>
      <thead>
        <tr>
          <th scope="col">#</th>
          <th scope="col">Player</th>
          {roundRobin
            ? order.map((p) => (
                <th key={p} scope="col">
                  {place.get(p)}
                </th>
              ))
            : Array.from({ length: view.rounds ?? 0 }, (_, r) => (
                <th key={r} scope="col">
                  R{r + 1}
                </th>
              ))}
        </tr>
      </thead>
      <tbody>
        {order.map((p) => (
          <tr key={p}>
            <td>{place.get(p)}</td>
            <th scope="row">{view.players[p]}</th>
            {roundRobin
              ? order.map((q) => {
                  const c = cells[p]!.find((x) => x.opponent === q);
                  return <td key={q}>{p === q ? "×" : c ? pointsText(c.score) : ""}</td>;
                })
              : Array.from({ length: view.rounds ?? 0 }, (_, r) => {
                  const c = cells[p]!.find((x) => x.round === r);
                  const text = !c
                    ? ""
                    : c.opponent === undefined
                      ? `${pointsText(c.score)} bye`
                      : `${pointsText(c.score)} v${place.get(c.opponent)} ${c.side === "light" ? "L" : "D"}`;
                  return <td key={r}>{text}</td>;
                })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** One event as the server reports it. */
export function EventScreen({
  view,
  onJoin,
  onStart,
  onPlay,
  onExit,
  busy,
  error,
}: {
  view: EventView;
  onJoin: (name: string) => void;
  onStart: () => void;
  onPlay: (ticket: Ticket) => void;
  onExit: () => void;
  busy?: boolean;
  error?: string;
}) {
  const [name, setName] = useState("");
  const [copied, setCopied] = useState(false);
  const { players, you, state, games } = view;
  const n = players.length;
  const round = games.length - 1;
  const mine =
    you === undefined ? undefined : games[round]?.find((g) => g.light === you || g.dark === you);
  const opponent = mine && (mine.light === you ? mine.dark : mine.light);
  const tiebreak = view.format === "roundRobin" ? "Sonneborn-Berger" : "Buchholz";
  const format = (count: number) =>
    (view.format ?? (count <= ROUND_ROBIN_MAX ? "roundRobin" : "swiss")) === "swiss"
      ? "Swiss"
      : "Round robin";

  return (
    <main>
      <section aria-label="Event" className="controls">
        <h1>Event {view.id}</h1>
        <p>
          Time control: {tcLabel(view.timeControl)}.{" "}
          {view.format
            ? `${format(n)}, ${state === "over" ? `${view.rounds} rounds, finished` : `Round ${round + 1} of ${view.rounds}`}.`
            : `${n} player${n === 1 ? "" : "s"} so far.`}
        </p>
        <p>
          Only people with the link can open this page. The event and its names are deleted 7 days
          after its last game.
        </p>
        <button
          type="button"
          onClick={async () =>
            setCopied(await copyText(location.origin + location.pathname + eventLink(view.id)))
          }
        >
          {copied ? "Link copied" : "Copy event link"}
        </button>

        {state === "open" && (
          <>
            <h2>Players</h2>
            <ol>
              {players.map((p, i) => (
                <li key={i}>
                  {p}
                  {i === 0 ? " (created the event)" : ""}
                  {i === you ? " (you)" : ""}
                </li>
              ))}
            </ol>
            {you === undefined ? (
              <>
                <label>
                  Your name{" "}
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    maxLength={NAME_MAX}
                  />
                </label>
                <p>{NAME_HINT}</p>
                <button type="button" onClick={() => onJoin(name)} disabled={busy || !name.trim()}>
                  Join
                </button>
              </>
            ) : view.host ? (
              <>
                <p>
                  {n < EVENT_MIN
                    ? `An event needs at least ${EVENT_MIN} players.`
                    : `${format(n)} with ${n} players. Nobody can join after the start.`}
                </p>
                <button type="button" onClick={onStart} disabled={busy || n < EVENT_MIN}>
                  Start the event
                </button>
              </>
            ) : (
              <p>Waiting for {players[0]} to start the event.</p>
            )}
          </>
        )}

        {state === "playing" && mine && (
          <>
            {mine.dark === undefined ? (
              <p>You have the bye this round: 1 point.</p>
            ) : mine.score ? (
              <p>
                Your game this round is over. The next round starts when every game has finished.
              </p>
            ) : (
              <>
                <p>
                  You play {mine.light === you ? "light" : "dark"} against {players[opponent!]}.
                  Lock your setup before your starting time runs out, or you lose this game on time.
                </p>
                {view.ticket && (
                  <button type="button" onClick={() => onPlay(view.ticket!)}>
                    Play your game
                  </button>
                )}
              </>
            )}
          </>
        )}

        <button type="button" onClick={onExit}>
          Back
        </button>
        {error && <p role="alert">{error}</p>}
      </section>
      {state !== "open" && (
        <section aria-label="Results" className="event">
          <h2>Round {round + 1}</h2>
          <ol aria-label="Pairings">
            {games[round]!.map((g, b) => (
              <li key={b}>
                {g.dark === undefined
                  ? `${players[g.light]}: bye`
                  : `${players[g.light]} (light) – ${players[g.dark]} (dark): ${resultText(g.score)}`}
              </li>
            ))}
          </ol>
          <table aria-label="Standings">
            <caption>{state === "over" ? "Final standings" : "Standings"}</caption>
            <thead>
              <tr>
                <th scope="col">Rank</th>
                <th scope="col">Player</th>
                <th scope="col">Points</th>
                <th scope="col">{tiebreak}</th>
              </tr>
            </thead>
            <tbody>
              {view.standings.map((s) => (
                <tr key={s.player}>
                  <td>{s.rank}</td>
                  <th scope="row">
                    {players[s.player]}
                    {s.player === you ? " (you)" : ""}
                  </th>
                  <td>{pointsText(s.score)}</td>
                  <td>{pointsText(s.tiebreak)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <Crosstable view={view} />
        </section>
      )}
    </main>
  );
}

const post = (body: unknown): RequestInit => ({
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

/** Keeps search engines off event pages while one is open (0007). */
function useNoIndex(): void {
  useEffect(() => {
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex";
    document.head.append(meta);
    return () => meta.remove();
  }, []);
}

/** Tournaments: create or open an event, then follow it. */
export function Events({
  initial,
  ruleset,
  store,
  onPlay,
  onExit,
}: {
  initial?: string;
  ruleset: ResolvedRuleset;
  store: KeyValueStore;
  onPlay: (ticket: Ticket) => void;
  onExit: () => void;
}) {
  const [code, setCode] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const request = (name: string, tc?: string): EventRequest => ({
    protocol: PROTOCOL,
    ruleset: { id: ruleset.id, version: ruleset.version },
    name,
    ...(tc && { timeControl: tc }),
  });
  // The address carries the open event, so a reload or a shared link comes back to it.
  useEffect(() => {
    history.replaceState(
      null,
      "",
      location.pathname + location.search + (code ? eventLink(code) : ""),
    );
  }, [code]);
  const open = (c: string | undefined) => {
    setError(undefined);
    setCode(c);
  };
  if (!code)
    return (
      <EventHome
        busy={busy}
        error={error}
        onOpen={open}
        onExit={onExit}
        onCreate={(name, tc) => {
          setBusy(true);
          setError(undefined);
          callApi<{ event: string; token: string }>(
            fetch,
            apiUrl(location, "/api/events"),
            post(request(name, tc)),
          )
            .then(({ event, token }) => {
              saveEventToken(store, event, token);
              open(event);
            })
            .catch((e: Error) => setError(e.message))
            .finally(() => setBusy(false));
        }}
      />
    );
  return (
    <EventPage
      key={code}
      code={code}
      store={store}
      request={request}
      onPlay={onPlay}
      onExit={() => open(undefined)}
    />
  );
}

function EventPage({
  code,
  store,
  request,
  onPlay,
  onExit,
}: {
  code: string;
  store: KeyValueStore;
  request: (name: string) => EventRequest;
  onPlay: (ticket: Ticket) => void;
  onExit: () => void;
}) {
  const [view, setView] = useState<EventView>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [token, setToken] = useState(() => loadEventToken(store, code));
  useNoIndex();

  useEffect(() => {
    let stopped = false;
    const load = () =>
      callApi<EventView>(fetch, apiUrl(location, `/api/events/${code}`), {
        headers: { "x-event-token": token ?? "" },
      })
        .then((v) => {
          if (stopped) return;
          setView(v);
          setError(undefined);
        })
        .catch((e: Error) => !stopped && setError(e.message));
    void load();
    const timer = setInterval(load, POLL_MS);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [code, token]);

  const act = <T,>(path: string, body: unknown, done: (result: T) => void) => {
    setBusy(true);
    setError(undefined);
    callApi<T>(fetch, apiUrl(location, `/api/events/${code}/${path}`), post(body))
      .then(done)
      .catch((e: Error) => setError(e.message))
      .finally(() => setBusy(false));
  };

  if (!view)
    return (
      <main>
        <p role="status">{error ?? "Loading the event…"}</p>
        <button type="button" onClick={onExit}>
          Back
        </button>
      </main>
    );
  return (
    <EventScreen
      view={view}
      busy={busy}
      error={error}
      onJoin={(name) =>
        act<{ token: string }>("join", request(name), (r) => {
          saveEventToken(store, code, r.token);
          setToken(r.token);
        })
      }
      onStart={() => act<EventView>("start", { token }, setView)}
      onPlay={onPlay}
      onExit={onExit}
    />
  );
}

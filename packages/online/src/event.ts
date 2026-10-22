/**
 * A private event by link (D20 default, provisional; docs/decisions/0007) as plain data, changed only
 * by these functions. Players join with a display name for this event only; the host (who created
 * it) starts it. Round robin up to 8 players, Swiss above. Each board is an event room (room.ts);
 * the server creates the rooms and reports their results here.
 */
import type { Random, ResolvedRuleset } from "@apexchess/engine";
import { DEFAULT_TIME_CONTROL, TIME_CONTROLS, timeControl } from "./clock";
import { checkName, nameKey } from "./names";
import {
  BYE_SCORE,
  roundRobinRound,
  roundRobinRounds,
  swissRound,
  swissRounds,
  type Pairing,
  type Played,
} from "./pairing";
import { PROTOCOL, type EventRef, type RulesetRef, type Ticket } from "./protocol";
import { RoomError } from "./room";
import { standings, type Standing } from "./standings";

/** D20: 4 to 32 players; round robin up to 8. */
export const EVENT_MIN = 4;
export const EVENT_MAX = 32;
export const ROUND_ROBIN_MAX = 8;

/** Controls with a clock, so an absent player loses and every round ends (0007). */
export const EVENT_CONTROLS = TIME_CONTROLS.filter(
  (c) => c.kind === "fischer" || c.kind === "perMove",
);

/** What `POST /api/events` and `.../join` carry. The time control counts only when creating. */
export interface EventRequest {
  protocol: number;
  ruleset: RulesetRef;
  timeControl?: string;
  name: string;
}

export interface EventPlayer {
  name: string;
  /** Secret that proves this player in the event; never shown to others. */
  token: string;
}

/** A board: its room and seat tokens once the server opens it; `score` once it ends. */
export interface EventGame extends Pairing {
  score?: [number, number];
  room?: string;
  tokens?: [string, string];
}

export interface EventData {
  id: string;
  ruleset: RulesetRef;
  timeControl: string;
  /** In joining order; the first is the host. */
  players: EventPlayer[];
  format?: "roundRobin" | "swiss";
  rounds?: number;
  /** Round robin: the round-1 coin turned every board around. */
  swap?: boolean;
  /** Boards by round; only rounds paired so far. */
  games: EventGame[][];
}

export type EventState = "open" | "playing" | "over";

/** What anyone with the link sees, plus their own place and game when they send their token. */
export interface EventView {
  type: "event";
  id: string;
  ruleset: RulesetRef;
  timeControl: string;
  state: EventState;
  format?: "roundRobin" | "swiss";
  rounds?: number;
  players: string[];
  games: (Pairing & { score?: [number, number] })[][];
  standings: Standing[];
  /** Your player number, when your token is in this event. */
  you?: number;
  host: boolean;
  /** Your game in the current round, while it is on. */
  ticket?: Ticket;
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const isText = (v: unknown, max = 32): v is string => typeof v === "string" && v.length <= max;

/** A request's shape, copied without extra fields; undefined if malformed. */
export function parseEventRequest(value: unknown): EventRequest | undefined {
  if (!isRecord(value) || typeof value.protocol !== "number") return undefined;
  const { ruleset, timeControl: tc, name } = value;
  if (!isRecord(ruleset) || !isText(ruleset.id) || !isText(ruleset.version)) return undefined;
  if ((tc !== undefined && !isText(tc)) || !isText(name, 64)) return undefined;
  return {
    protocol: value.protocol,
    ruleset: { id: ruleset.id, version: ruleset.version },
    ...(tc !== undefined && { timeControl: tc }),
    name,
  };
}

function checkRequest(ruleset: ResolvedRuleset, req: EventRequest): string {
  if (req.protocol !== PROTOCOL)
    throw new RoomError("protocol", "This page is out of date. Reload to play online.");
  if (ruleset.id !== req.ruleset.id || ruleset.version !== req.ruleset.version)
    throw new RoomError(
      "ruleset",
      `This event uses ${ruleset.id}@${ruleset.version}, not ${req.ruleset.id}@${req.ruleset.version}. Reload to update.`,
    );
  const checked = checkName(req.name);
  if ("error" in checked) throw new RoomError("name", checked.error);
  return checked.name;
}

export const eventState = (ev: EventData): EventState =>
  !ev.format
    ? "open"
    : ev.games.length === ev.rounds && ev.games.at(-1)!.every((g) => g.score)
      ? "over"
      : "playing";

/** A new event with its host as the first player. */
export function createEvent(
  id: string,
  ruleset: ResolvedRuleset,
  req: EventRequest,
  token: string,
): EventData {
  const name = checkRequest(ruleset, req);
  const tc = timeControl(req.timeControl ?? DEFAULT_TIME_CONTROL);
  if (!tc || !EVENT_CONTROLS.some((c) => c.id === tc.id))
    throw new RoomError("timeControl", "Events need a time control with a clock.");
  return {
    id,
    ruleset: { id: ruleset.id, version: ruleset.version },
    timeControl: tc.id,
    players: [{ name, token }],
    games: [],
  };
}

export function joinEvent(
  ev: EventData,
  ruleset: ResolvedRuleset,
  req: EventRequest,
  token: string,
): EventData {
  if (ev.format) throw new RoomError("started", "This event has already started.");
  if (ev.players.length >= EVENT_MAX)
    throw new RoomError("full", `This event already has ${EVENT_MAX} players.`);
  const name = checkRequest(ruleset, req);
  if (ev.players.some((p) => nameKey(p.name) === nameKey(name)))
    throw new RoomError("name", "Someone in this event already has that name.");
  return { ...ev, players: [...ev.players, { name, token }] };
}

const played = (ev: EventData): Played[][] => ev.games as Played[][];

/** Pair the next round; byes score at once. Swiss uses the coin in round 1 only. */
function pairNext(ev: EventData, random: Random): EventData {
  const n = ev.players.length;
  const r = ev.games.length;
  const boards =
    ev.format === "roundRobin" ? roundRobinRound(n, r, ev.swap) : swissRound(n, played(ev), random);
  const round = boards.map((g): EventGame =>
    g.dark === undefined ? { ...g, score: [BYE_SCORE, 0] } : g,
  );
  return { ...ev, games: [...ev.games, round] };
}

/** The host starts the event: the format and number of rounds follow from the players (D20). */
export function startEvent(ev: EventData, token: string, random: Random): EventData {
  if (ev.format) throw new RoomError("started", "This event has already started.");
  if (ev.players[0]!.token !== token)
    throw new RoomError("host", "Only the player who created this event can start it.");
  const n = ev.players.length;
  if (n < EVENT_MIN)
    throw new RoomError("players", `An event needs at least ${EVENT_MIN} players to start.`);
  const roundRobin = n <= ROUND_ROBIN_MAX;
  return pairNext(
    {
      ...ev,
      format: roundRobin ? "roundRobin" : "swiss",
      rounds: roundRobin ? roundRobinRounds(n) : swissRounds(n),
      ...(roundRobin && { swap: random() >= 0.5 }),
    },
    random,
  );
}

/** Boards in the current round that still need a room. */
export function openBoards(ev: EventData): EventRef[] {
  const round = ev.games.length - 1;
  if (round < 0) return [];
  return ev.games[round]!.flatMap((g, board) =>
    g.dark !== undefined && !g.room && !g.score ? [{ id: ev.id, round, board }] : [],
  );
}

const replaceGame = (ev: EventData, at: EventRef, game: EventGame): EventData => ({
  ...ev,
  games: ev.games.map((round, r) =>
    r === at.round ? round.map((g, b) => (b === at.board ? game : g)) : round,
  ),
});

/** The server opened this board's room; `tokens` are light's then dark's. */
export function withRoom(
  ev: EventData,
  at: Omit<EventRef, "id">,
  room: string,
  tokens: [string, string],
): EventData {
  const game = ev.games[at.round]?.[at.board];
  if (!game || game.room) return ev;
  return replaceGame(ev, { id: ev.id, ...at }, { ...game, room, tokens });
}

/**
 * A board's result, [light, dark] points, recorded once. When it finishes the round, the next
 * round is paired. Unknown boards and repeats leave the event unchanged.
 */
export function recordResult(
  ev: EventData,
  at: Omit<EventRef, "id">,
  score: [number, number],
): EventData {
  const game = ev.games[at.round]?.[at.board];
  if (!game || game.score || game.dark === undefined) return ev;
  const next = replaceGame(ev, { id: ev.id, ...at }, { ...game, score });
  const done = next.games.at(-1)!.every((g) => g.score);
  // After round 1 pairing is deterministic, so no coin is needed.
  return done && next.games.length < next.rounds! ? pairNext(next, () => 0.5) : next;
}

/** The event as `token`'s holder may see it; tokens and room codes stay hidden from everyone else. */
export function eventView(ev: EventData, token?: string): EventView {
  const at = token ? ev.players.findIndex((p) => p.token === token) : -1;
  const you = at >= 0 ? at : undefined;
  const current = ev.games.at(-1);
  const mine =
    you === undefined ? undefined : current?.find((g) => g.light === you || g.dark === you);
  const ticket =
    mine?.room && mine.tokens && !mine.score
      ? { room: mine.room, token: mine.tokens[mine.light === you ? 0 : 1] }
      : undefined;
  const finished = ev.games.map((round) => round.filter((g) => g.score)) as Played[][];
  return {
    type: "event",
    id: ev.id,
    ruleset: ev.ruleset,
    timeControl: ev.timeControl,
    state: eventState(ev),
    ...(ev.format && { format: ev.format, rounds: ev.rounds }),
    players: ev.players.map((p) => p.name),
    games: ev.games.map((round) =>
      round.map((g) => ({
        light: g.light,
        ...(g.dark !== undefined && { dark: g.dark }),
        ...(g.score && { score: g.score }),
      })),
    ),
    standings: standings(
      ev.players.length,
      finished,
      ev.format === "roundRobin" ? "sonnebornBerger" : "buchholz",
    ),
    ...(you !== undefined && { you }),
    host: you === 0,
    ...(ticket && { ticket }),
  };
}

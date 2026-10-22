/**
 * Cloudflare Worker for /api (the static app is served from assets). Each room is a Durable Object
 * that holds both locked setups and the game; the quick-match queue is another, and so is each event
 * (D20), which opens one room per board and hears back when it ends. Game logic lives in
 * @apexchess/online; this file only stores, routes, and sends.
 */
import { DurableObject } from "cloudflare:workers";
import { catalog, resolveRuleset, type ResolvedRuleset } from "@apexchess/engine";
import {
  RoomError,
  act,
  archiveRecord,
  archiveRow,
  createEvent,
  createEventRoom,
  createRoom,
  deadline,
  eventScore,
  eventView,
  joinEvent,
  joinRoom,
  leave,
  lockTimeControl,
  openBoards,
  parseClientMessage,
  parseEventRequest,
  parseLock,
  parseSeek,
  presence,
  ratedGame,
  recordResult,
  seatOf,
  seek,
  startEvent,
  tick,
  viewFor,
  withRoom,
  type ErrorCode,
  type EventData,
  type EventRef,
  type EventRequest,
  type Lock,
  type RoomData,
  type RulesetRef,
  type Seat,
  type Seek,
  type ServerMessage,
  type Ticket,
} from "@apexchess/online";
import { accountAction, cleanUpAccounts, sessionAccount } from "./accounts";
import { insertGame } from "./archive";
import { rateGame } from "./ratings";
import { bearerToken, clientKey, httpStatus, passkeyOrigin, roomCode, route } from "./routes";
import { getStats, listStats, refreshStats } from "./stats";

interface Env {
  ROOMS: DurableObjectNamespace<Room>;
  LOBBY: DurableObjectNamespace<Lobby>;
  /** Private events by link (D20). */
  EVENTS: DurableObjectNamespace<Tournament>;
  /**
   * Anonymous archive of finished games (S19a) and its statistics (S19b); accounts (S19c) live in
   * their own tables in the same database. docs/decisions/0006.
   */
  ARCHIVE: D1Database;
  /** Requests per address per minute on /api (limit in wrangler.jsonc; provisional). */
  LIMITER: RateLimit;
}

/**
 * Rooms and events are deleted this long after their last change (provisional; 0005, 0007). An
 * event's last change is its last game's result.
 */
const KEEP_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_BODY = 8 * 1024;
/** Room socket messages; an event game's lock carries a whole setup. */
const MAX_MESSAGE = 2 * 1024;
/** An event game whose result did not reach its event tries again after this long. */
const REPORT_RETRY_MS = 60 * 1000;

const random = () => crypto.getRandomValues(new Uint32Array(1))[0]! / 2 ** 32;
const newToken = () => crypto.randomUUID();
const send = (ws: WebSocket, msg: ServerMessage) => ws.send(JSON.stringify(msg));
const fail = (code: ErrorCode, message: string): ServerMessage => ({
  type: "error",
  code,
  message,
});
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
/** Statistics change once a day, so browsers and Cloudflare may keep them for an hour. */
const publicJson = (text: string) =>
  new Response(text, {
    headers: { "content-type": "application/json", "cache-control": "public, max-age=3600" },
  });
const errorResponse = (e: RoomError) => json(fail(e.code, e.message), httpStatus(e.code));
/** Event answers: never cached, never indexed (0007). */
const eventJson = (body: unknown, status = 200) => {
  const res = json(body, status);
  res.headers.set("x-robots-tag", "noindex");
  return res;
};

/** The ruleset at exactly this id and version, as shipped with this server. */
function rulesetFor(ref: RulesetRef): ResolvedRuleset {
  try {
    return resolveRuleset(catalog, ref.id, ref.version);
  } catch {
    throw new RoomError(
      "ruleset",
      `This server does not play ${ref.id}@${ref.version}. Reload to update.`,
    );
  }
}

/** A request body parsed by `parse`, or a "bad" error. */
async function readBody<T>(req: Request, parse: (value: unknown) => T | undefined): Promise<T> {
  const text = await req.text();
  let body: T | undefined;
  try {
    body = text.length <= MAX_BODY ? parse(JSON.parse(text)) : undefined;
  } catch {
    body = undefined;
  }
  if (body === undefined) throw new RoomError("bad", "That request was not understood.");
  return body;
}

const readLock = (req: Request) => readBody(req, parseLock);

/** Ask a room object to create or join; it answers a Ticket or an error message. */
async function callRoom(env: Env, code: string, path: "create" | "join", body: unknown) {
  const stub = env.ROOMS.get(env.ROOMS.idFromName(code));
  const res = await stub.fetch(`https://room/${path}`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as Ticket | Extract<ServerMessage, { type: "error" }>;
  if ("type" in data) throw new RoomError(data.code, data.message);
  return data;
}

/**
 * A new room with this player waiting in it. Retries on the rare code already in use. Only quick
 * match passes `account` (a signed-in player, so the game can be rated, S19d).
 */
async function openRoom(env: Env, lock: Lock, account?: string): Promise<Ticket> {
  for (let i = 0; i < 5; i++) {
    const code = roomCode(crypto.getRandomValues(new Uint8Array(6)));
    try {
      return await callRoom(env, code, "create", { code, lock, token: newToken(), account });
    } catch (e) {
      if (!(e instanceof RoomError && e.code === "full")) throw e;
    }
  }
  throw new RoomError("full", "Could not open a room. Try again.");
}

const enterRoom = (env: Env, code: string, lock: Lock, account?: string) =>
  callRoom(env, code, "join", { lock, token: newToken(), account });

/** The room with a signed-in player's account on `seat` (quick match only, S19d). */
const withAccount = (room: RoomData, seat: Seat, account: string | undefined): RoomData =>
  account
    ? { ...room, seats: room.seats.map((s, i) => (i === seat ? { ...s, account } : s)) }
    : room;

/** POST to a Durable Object; an error answer becomes a RoomError. */
async function callObject<T>(
  stub: { fetch: typeof fetch },
  path: string,
  body: unknown,
): Promise<T> {
  const res = await stub.fetch(`https://object/${path}`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as T | Extract<ServerMessage, { type: "error" }>;
  if (data && typeof data === "object" && "type" in data && data.type === "error")
    throw new RoomError(data.code, data.message);
  return data as T;
}

/** Try new codes until `open` finds a free one (a "full" error means taken). */
async function withNewCode<T>(open: (code: string) => Promise<T>): Promise<T> {
  for (let i = 0; i < 5; i++) {
    try {
      return await open(roomCode(crypto.getRandomValues(new Uint8Array(6))));
    } catch (e) {
      if (!(e instanceof RoomError && e.code === "full")) throw e;
    }
  }
  throw new RoomError("full", "Could not open a new code. Try again.");
}

const eventStub = (env: Env, code: string) => env.EVENTS.get(env.EVENTS.idFromName(code));

/** A new event with its creator as host. */
const openEvent = (env: Env, request: EventRequest) =>
  withNewCode((code) =>
    callObject<{ event: string; token: string }>(eventStub(env, code), "create", {
      code,
      request,
      token: newToken(),
    }),
  );

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const r = route(req.method, url.pathname);
    if (!r) return json(fail("notFound", "No such address."), 404);
    const { success } = await env.LIMITER.limit({ key: clientKey(req.headers) });
    if (!success) return json(fail("busy", "Too many requests. Wait a minute and try again."), 429);
    try {
      if (r.kind === "create") return json(await openRoom(env, await readLock(req)));
      if (r.kind === "join") return json(await enterRoom(env, r.room, await readLock(req)));
      if (r.kind === "newEvent")
        return eventJson(await openEvent(env, await readBody(req, parseEventRequest)));
      if (r.kind === "joinEvent")
        return eventJson(
          await callObject(eventStub(env, r.event), "join", await readBody(req, parseEventRequest)),
        );
      if (r.kind === "startEvent")
        return eventJson(
          await callObject(eventStub(env, r.event), "start", await readBody(req, parseToken)),
        );
      if (r.kind === "event")
        return eventJson(
          await callObject(eventStub(env, r.event), "view", {
            token: req.headers.get("x-event-token") ?? "",
          }),
        );
      if (r.kind === "account" || r.kind === "report") {
        const text = req.method === "POST" ? await req.text() : "";
        let body: unknown;
        try {
          body = text && text.length <= MAX_BODY ? JSON.parse(text) : undefined;
        } catch {
          body = undefined;
        }
        const result = await accountAction(
          r.kind === "report" ? "report" : r.action,
          body,
          bearerToken(req.headers),
          {
            db: env.ARCHIVE,
            now: Date.now(),
            site: passkeyOrigin(req),
            random: (n) => crypto.getRandomValues(new Uint8Array(n)),
          },
        );
        return json(result);
      }
      if (r.kind === "stats") return publicJson(JSON.stringify(await listStats(env.ARCHIVE)));
      if (r.kind === "snapshot") {
        const text = await getStats(env.ARCHIVE, r.ruleset.id, r.ruleset.version);
        if (text === null)
          return json(fail("notFound", "No statistics for that ruleset yet."), 404);
        return publicJson(text);
      }
      if (req.headers.get("upgrade") !== "websocket")
        return json(fail("bad", "Expected a WebSocket."), 426);
      if (r.kind === "socket") return env.ROOMS.get(env.ROOMS.idFromName(r.room)).fetch(req);
      return env.LOBBY.get(env.LOBBY.idFromName("lobby")).fetch(req);
    } catch (e) {
      if (!(e instanceof RoomError)) throw e;
      const forEvent = ["newEvent", "joinEvent", "startEvent", "event"].includes(r.kind);
      return forEvent ? eventJson(fail(e.code, e.message), httpStatus(e.code)) : errorResponse(e);
    }
  },

  /** The daily job (cron in wrangler.jsonc): statistics, then expired account sessions. */
  async scheduled(controller: ScheduledController, env: Env): Promise<void> {
    const written = await refreshStats(env.ARCHIVE, controller.scheduledTime);
    console.log("stats: wrote", written, "snapshots");
    await cleanUpAccounts(env.ARCHIVE, controller.scheduledTime);
  },
} satisfies ExportedHandler<Env>;

const parseToken = (value: unknown) =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as { token?: unknown }).token === "string"
    ? { token: (value as { token: string }).token.slice(0, 64) }
    : undefined;

const seatTag = (seat: Seat) => `seat:${seat}`;

/**
 * One room: its data in storage, one socket per seat (a new one replaces the old), hibernating
 * between messages. One alarm serves both the clock (a flag falls, D19) and retention.
 */
export class Room extends DurableObject<Env> {
  private room?: RoomData;

  private async load(): Promise<RoomData | undefined> {
    this.room ??= await this.ctx.storage.get<RoomData>("room");
    return this.room;
  }

  /** Store a change; the room expires KEEP_MS after it. */
  private async save(room: RoomData): Promise<void> {
    this.room = room;
    const expires = Date.now() + KEEP_MS;
    await this.ctx.storage.put({ room, expires });
    await this.rearm(room, expires);
  }

  /** The alarm fires at expiry, the game's deadline, or a retry of an unsent event result. */
  private async rearm(room: RoomData, expires: number): Promise<void> {
    const retry = (await this.ctx.storage.get<boolean>("report"))
      ? Date.now() + REPORT_RETRY_MS
      : Infinity;
    await this.ctx.storage.setAlarm(Math.min(expires, deadline(room) ?? Infinity, retry));
  }

  /** Save, send, archive, and tell the event (D20) about a change from `before` to `after`. */
  private async commit(before: RoomData, after: RoomData, closing?: WebSocket): Promise<void> {
    if (after.event && after.end && !before.end) await this.ctx.storage.put("report", true);
    await this.save(after);
    this.broadcast(after, closing);
    await this.archive(before, after);
    await this.rate(before, after);
    await this.report(after);
  }

  /** Send an ended event game's result to its event; on failure the alarm tries again. */
  private async report(room: RoomData): Promise<void> {
    if (!room.event || !room.end || !(await this.ctx.storage.get<boolean>("report"))) return;
    const { id, round, board } = room.event;
    try {
      await callObject(eventStub(this.env, id), "result", {
        round,
        board,
        score: eventScore(room.end),
      });
      await this.ctx.storage.delete("report");
    } catch (e) {
      console.error("event result not sent", e);
    }
  }

  /** Who is connected, without a socket on its way out. */
  private online(closing?: WebSocket): [boolean, boolean] {
    return [this.sockets(0, closing).length > 0, this.sockets(1, closing).length > 0];
  }

  /** Abandonment-only rooms (D19) track who is away; other rooms are unchanged. */
  private async seePresence(room: RoomData, closing?: WebSocket): Promise<RoomData> {
    const next = presence(room, this.online(closing), Date.now());
    if (next !== room) await this.save(next);
    return next;
  }

  private sockets(seat: Seat, except?: WebSocket): WebSocket[] {
    return this.ctx.getWebSockets(seatTag(seat)).filter((ws) => ws !== except);
  }

  /** Send each connected player their own view. `closing` is a socket on its way out. */
  private broadcast(room: RoomData, closing?: WebSocket): void {
    const now = Date.now();
    for (const seat of [0, 1] as const) {
      const online = this.sockets(seat === 0 ? 1 : 0, closing).length > 0;
      for (const ws of this.sockets(seat, closing)) send(ws, viewFor(room, seat, online, now));
    }
  }

  override async fetch(req: Request): Promise<Response> {
    const path = new URL(req.url).pathname;
    try {
      if (path === "/create") {
        const { code, lock, token, account } = (await req.json()) as {
          code: string;
          lock: Lock;
          token: string;
          account?: string;
        };
        if (await this.load()) throw new RoomError("full", "That room code is in use.");
        await this.save(
          withAccount(createRoom(code, rulesetFor(lock.ruleset), lock, token), 0, account),
        );
        return json({ room: code, token } satisfies Ticket);
      }
      if (path === "/event") {
        const { code, ruleset, timeControl, tokens, event } = (await req.json()) as {
          code: string;
          ruleset: RulesetRef;
          timeControl: string;
          tokens: [string, string];
          event: EventRef;
        };
        if (await this.load()) throw new RoomError("full", "That room code is in use.");
        await this.save(
          createEventRoom(code, rulesetFor(ruleset), timeControl, tokens, event, Date.now()),
        );
        return json({ room: code });
      }
      if (path === "/join") {
        const { lock, token, account } = (await req.json()) as {
          lock: Lock;
          token: string;
          account?: string;
        };
        const room = await this.load();
        if (!room) throw new RoomError("notFound", "No room has that code.");
        const joined = withAccount(
          joinRoom(room, rulesetFor(lock.ruleset), lock, token, random, Date.now()),
          1,
          account,
        );
        await this.save(joined);
        this.broadcast(joined);
        return json({ room: room.id, token } satisfies Ticket);
      }
      return await this.openSocket(req);
    } catch (e) {
      if (e instanceof RoomError) return errorResponse(e);
      throw e;
    }
  }

  /** A player's socket. A bad token still gets a socket, so the page can read why it was closed. */
  private async openSocket(req: Request): Promise<Response> {
    const token = new URL(req.url).searchParams.get("token") ?? "";
    const room = await this.load();
    const seat = room && seatOf(room, token);
    const [client, server] = Object.values(new WebSocketPair()) as [WebSocket, WebSocket];
    if (!room || seat === undefined) {
      server.accept();
      send(server, fail(room ? "token" : "notFound", "This game is no longer available."));
      server.close(4000, "not in this room");
      return new Response(null, { status: 101, webSocket: client });
    }
    for (const old of this.sockets(seat)) old.close(4001, "opened elsewhere");
    this.ctx.acceptWebSocket(server, [seatTag(seat)]);
    this.broadcast(await this.seePresence(room));
    return new Response(null, { status: 101, webSocket: client });
  }

  override async webSocketMessage(ws: WebSocket, data: string | ArrayBuffer): Promise<void> {
    const room = await this.load();
    const seat = this.ctx.getTags(ws)[0] === seatTag(1) ? 1 : 0;
    const msg =
      typeof data === "string" && data.length <= MAX_MESSAGE ? parseClientMessage(data) : undefined;
    if (!room || !msg) return send(ws, fail("bad", "That message was not understood."));
    try {
      const next = act(room, rulesetFor(room.ruleset), seat, msg, Date.now());
      if (next !== room) await this.commit(room, next);
    } catch (e) {
      if (!(e instanceof RoomError)) throw e;
      send(ws, fail(e.code, e.message));
    }
  }

  /** Update both ratings once, as a rated game ends (S19d). A failed write is logged and never stops play. */
  private async rate(before: RoomData, after: RoomData): Promise<void> {
    const game = ratedGame(before, after);
    if (!game) return;
    try {
      await rateGame(this.env.ARCHIVE, game);
    } catch (e) {
      console.error("rating update failed", e);
    }
  }

  /** Write the game to the archive once, as it ends. A failed write is logged and never stops play. */
  private async archive(before: RoomData, after: RoomData): Promise<void> {
    const rec = archiveRecord(before, after, Date.now());
    if (!rec) return;
    const { sql, values } = insertGame(archiveRow(rec), crypto.randomUUID());
    try {
      await this.env.ARCHIVE.prepare(sql)
        .bind(...values)
        .run();
    } catch (e) {
      console.error("archive write failed", e);
    }
  }

  override async webSocketClose(ws: WebSocket): Promise<void> {
    const room = await this.load();
    if (room) this.broadcast(await this.seePresence(room, ws), ws);
  }

  override async webSocketError(ws: WebSocket): Promise<void> {
    await this.webSocketClose(ws);
  }

  /** A deadline (the game ends on time) or retention (the room and its game are deleted). */
  override async alarm(): Promise<void> {
    const room = await this.load();
    const expires = (await this.ctx.storage.get<number>("expires")) ?? 0;
    const now = Date.now();
    if (room && now < expires) {
      await this.report(room);
      let next = room;
      try {
        next = tick(room, rulesetFor(room.ruleset), now);
      } catch (e) {
        if (!(e instanceof RoomError)) throw e;
      }
      if (next !== room) return this.commit(room, next);
      // Early or nothing due: wait for whichever comes first again.
      return this.rearm(room, expires);
    }
    for (const ws of this.ctx.getWebSockets()) ws.close(4002, "room expired");
    this.room = undefined;
    await this.ctx.storage.deleteAll();
  }
}

interface Waiting {
  ticket: string;
  ruleset: string;
  timeControl: string;
  lock: Lock;
  /** A signed-in player's account id (S19d); absent for anonymous players. */
  account?: string;
}

/** Quick match: each socket sends one locked setup, waits, and is told its room when paired. */
export class Lobby extends DurableObject<Env> {
  override async fetch(): Promise<Response> {
    const [client, server] = Object.values(new WebSocketPair()) as [WebSocket, WebSocket];
    this.ctx.acceptWebSocket(server, [newToken()]);
    return new Response(null, { status: 101, webSocket: client });
  }

  /** The queue, without players whose sockets are gone. */
  private async queue(): Promise<Waiting[]> {
    const queue = (await this.ctx.storage.get<Waiting[]>("queue")) ?? [];
    return queue.filter((w) => this.ctx.getWebSockets(w.ticket).length > 0);
  }

  override async webSocketMessage(ws: WebSocket, data: string | ArrayBuffer): Promise<void> {
    const ticket = this.ctx.getTags(ws)[0]!;
    let wanted: Seek | undefined;
    try {
      const value: unknown =
        typeof data === "string" && data.length <= MAX_BODY && JSON.parse(data);
      wanted = parseSeek(value);
    } catch {
      wanted = undefined;
    }
    if (!wanted) return send(ws, fail("bad", "That message was not understood."));
    const { lock } = wanted;
    try {
      // Check the setup now, so a bad one never reaches a room.
      createRoom("check", rulesetFor(lock.ruleset), lock, ticket);
      const key = `${lock.ruleset.id}@${lock.ruleset.version}`;
      const timeControl = lockTimeControl(lock).id;
      const account = wanted.session && (await this.accountOf(wanted.session));
      const seeker: Waiting = {
        ticket,
        ruleset: key,
        timeControl,
        lock,
        ...(account && { account }),
      };
      const { queue, pair } = seek(await this.queue(), seeker);
      await this.ctx.storage.put("queue", queue);
      if (!pair) return send(ws, { type: "seeking" });
      const [first, second] = pair;
      const opened = await openRoom(this.env, first.lock, first.account);
      const joined = await enterRoom(this.env, opened.room, second.lock, second.account);
      for (const [w, t] of [
        [first, opened],
        [second, joined],
      ] as const)
        for (const s of this.ctx.getWebSockets(w.ticket)) {
          send(s, { type: "matched", room: t.room, token: t.token });
          s.close(1000, "matched");
        }
    } catch (e) {
      if (!(e instanceof RoomError)) throw e;
      send(ws, fail(e.code, e.message));
    }
  }

  /** The signed-in account, or undefined; if D1 fails the player still plays, unrated. */
  private async accountOf(session: string): Promise<string | undefined> {
    try {
      return await sessionAccount(this.env.ARCHIVE, session, Date.now());
    } catch (e) {
      console.error("session lookup failed", e);
      return undefined;
    }
  }

  override async webSocketClose(ws: WebSocket): Promise<void> {
    const ticket = this.ctx.getTags(ws)[0]!;
    await this.ctx.storage.put("queue", leave(await this.queue(), ticket));
  }
}

/**
 * One event (D20): its data in storage, deleted KEEP_MS after its last change. Changes run one at a
 * time, since opening rooms waits on other objects.
 */
export class Tournament extends DurableObject<Env> {
  private ev?: EventData;

  private async load(): Promise<EventData | undefined> {
    this.ev ??= await this.ctx.storage.get<EventData>("event");
    return this.ev;
  }

  private async save(ev: EventData): Promise<void> {
    this.ev = ev;
    const expires = Date.now() + KEEP_MS;
    await this.ctx.storage.put({ event: ev, expires });
    await this.ctx.storage.setAlarm(expires);
  }

  private async existing(): Promise<EventData> {
    const ev = await this.load();
    if (!ev) throw new RoomError("notFound", "No event has that code.");
    return ev;
  }

  /** Open a room for each board that has none; a board that fails waits for the next try. */
  private async openRooms(ev: EventData): Promise<EventData> {
    for (const at of openBoards(ev)) {
      const tokens: [string, string] = [newToken(), newToken()];
      try {
        const { room } = await withNewCode((code) =>
          callObject<{ room: string }>(
            this.env.ROOMS.get(this.env.ROOMS.idFromName(code)),
            "event",
            {
              code,
              ruleset: ev.ruleset,
              timeControl: ev.timeControl,
              tokens,
              event: at,
            },
          ),
        );
        ev = withRoom(ev, at, room, tokens);
      } catch (e) {
        console.error("event room not opened", e);
      }
    }
    return ev;
  }

  /**
   * One request at a time. A RoomError is caught inside: an exception escaping
   * blockConcurrencyWhile would reset the object.
   */
  override async fetch(req: Request): Promise<Response> {
    const path = new URL(req.url).pathname;
    const body = (await req.json()) as Record<string, unknown>;
    const out = await this.ctx.blockConcurrencyWhile(async (): Promise<unknown> => {
      try {
        return await this.handle(path, body);
      } catch (e) {
        if (e instanceof RoomError) return e;
        throw e;
      }
    });
    return out instanceof RoomError ? errorResponse(out) : json(out);
  }

  private async handle(path: string, body: Record<string, unknown>): Promise<unknown> {
    if (path === "/create") {
      const { code, request, token } = body as {
        code: string;
        request: EventRequest;
        token: string;
      };
      if (await this.load()) throw new RoomError("full", "That event code is in use.");
      await this.save(createEvent(code, rulesetFor(request.ruleset), request, token));
      return { event: code, token };
    }
    const ev = await this.existing();
    if (path === "/join") {
      const token = newToken();
      await this.save(
        joinEvent(ev, rulesetFor(ev.ruleset), body as unknown as EventRequest, token),
      );
      return { event: ev.id, token };
    }
    if (path === "/start") {
      const token = String(body.token);
      const started = await this.openRooms(startEvent(ev, token, random));
      await this.save(started);
      return eventView(started, token);
    }
    if (path === "/result") {
      const { round, board, score } = body as {
        round: number;
        board: number;
        score: [number, number];
      };
      const next = recordResult(ev, { round, board }, score);
      if (next !== ev) await this.save(await this.openRooms(next));
      return { ok: true };
    }
    // A view also retries boards whose room did not open.
    const token = String(body.token);
    if (!openBoards(ev).length) return eventView(ev, token);
    const opened = await this.openRooms(ev);
    if (opened !== ev) await this.save(opened);
    return eventView(opened, token);
  }

  /** Retention: the event, its names, and its pairings are deleted. */
  override async alarm(): Promise<void> {
    const expires = (await this.ctx.storage.get<number>("expires")) ?? 0;
    if (Date.now() < expires) return this.ctx.storage.setAlarm(expires);
    this.ev = undefined;
    await this.ctx.storage.deleteAll();
  }
}

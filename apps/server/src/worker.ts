/**
 * Cloudflare Worker for /api (the static app is served from assets). Each room is a Durable Object
 * that holds both locked setups and the game; the quick-match queue is another. Game logic lives in
 * @apexchess/online; this file only stores, routes, and sends.
 */
import { DurableObject } from "cloudflare:workers";
import { catalog, resolveRuleset, type ResolvedRuleset } from "@apexchess/engine";
import {
  RoomError,
  act,
  archiveRecord,
  archiveRow,
  createRoom,
  joinRoom,
  leave,
  parseClientMessage,
  parseLock,
  seatOf,
  seek,
  viewFor,
  type ErrorCode,
  type Lock,
  type RoomData,
  type RulesetRef,
  type Seat,
  type ServerMessage,
  type Ticket,
} from "@apexchess/online";
import { insertGame } from "./archive";
import { clientKey, httpStatus, roomCode, route } from "./routes";
import { getStats, listStats, refreshStats } from "./stats";

interface Env {
  ROOMS: DurableObjectNamespace<Room>;
  LOBBY: DurableObjectNamespace<Lobby>;
  /** Anonymous archive of finished games (S19a) and its statistics (S19b); docs/decisions/0006. */
  ARCHIVE: D1Database;
  /** Requests per address per minute on /api (limit in wrangler.jsonc; provisional). */
  LIMITER: RateLimit;
}

/** Rooms are deleted this long after their last change (provisional; see docs/decisions/0005). */
const KEEP_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_BODY = 8 * 1024;
const MAX_MESSAGE = 1024;

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

async function readLock(req: Request): Promise<Lock> {
  const text = await req.text();
  let lock: Lock | undefined;
  try {
    lock = text.length <= MAX_BODY ? parseLock(JSON.parse(text)) : undefined;
  } catch {
    lock = undefined;
  }
  if (!lock) throw new RoomError("bad", "That request was not understood.");
  return lock;
}

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

/** A new room with this player waiting in it. Retries on the rare code already in use. */
async function openRoom(env: Env, lock: Lock): Promise<Ticket> {
  for (let i = 0; i < 5; i++) {
    const code = roomCode(crypto.getRandomValues(new Uint8Array(6)));
    try {
      return await callRoom(env, code, "create", { code, lock, token: newToken() });
    } catch (e) {
      if (!(e instanceof RoomError && e.code === "full")) throw e;
    }
  }
  throw new RoomError("full", "Could not open a room. Try again.");
}

const enterRoom = (env: Env, code: string, lock: Lock) =>
  callRoom(env, code, "join", { lock, token: newToken() });

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
      if (e instanceof RoomError) return errorResponse(e);
      throw e;
    }
  },

  /** The daily statistics job (cron in wrangler.jsonc). */
  async scheduled(controller: ScheduledController, env: Env): Promise<void> {
    const written = await refreshStats(env.ARCHIVE, controller.scheduledTime);
    console.log("stats: wrote", written, "snapshots");
  },
} satisfies ExportedHandler<Env>;

const seatTag = (seat: Seat) => `seat:${seat}`;

/** One room: its data in storage, one socket per seat (a new one replaces the old), hibernating between messages. */
export class Room extends DurableObject<Env> {
  private room?: RoomData;

  private async load(): Promise<RoomData | undefined> {
    this.room ??= await this.ctx.storage.get<RoomData>("room");
    return this.room;
  }

  private async save(room: RoomData): Promise<void> {
    this.room = room;
    await this.ctx.storage.put("room", room);
    await this.ctx.storage.setAlarm(Date.now() + KEEP_MS);
  }

  private sockets(seat: Seat, except?: WebSocket): WebSocket[] {
    return this.ctx.getWebSockets(seatTag(seat)).filter((ws) => ws !== except);
  }

  /** Send each connected player their own view. `closing` is a socket on its way out. */
  private broadcast(room: RoomData, closing?: WebSocket): void {
    for (const seat of [0, 1] as const) {
      const online = this.sockets(seat === 0 ? 1 : 0, closing).length > 0;
      for (const ws of this.sockets(seat, closing)) send(ws, viewFor(room, seat, online));
    }
  }

  override async fetch(req: Request): Promise<Response> {
    const path = new URL(req.url).pathname;
    try {
      if (path === "/create") {
        const { code, lock, token } = (await req.json()) as {
          code: string;
          lock: Lock;
          token: string;
        };
        if (await this.load()) throw new RoomError("full", "That room code is in use.");
        await this.save(createRoom(code, rulesetFor(lock.ruleset), lock, token));
        return json({ room: code, token } satisfies Ticket);
      }
      if (path === "/join") {
        const { lock, token } = (await req.json()) as { lock: Lock; token: string };
        const room = await this.load();
        if (!room) throw new RoomError("notFound", "No room has that code.");
        const joined = joinRoom(room, rulesetFor(lock.ruleset), lock, token, random);
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
    this.broadcast(room);
    return new Response(null, { status: 101, webSocket: client });
  }

  override async webSocketMessage(ws: WebSocket, data: string | ArrayBuffer): Promise<void> {
    const room = await this.load();
    const seat = this.ctx.getTags(ws)[0] === seatTag(1) ? 1 : 0;
    const msg =
      typeof data === "string" && data.length <= MAX_MESSAGE ? parseClientMessage(data) : undefined;
    if (!room || !msg) return send(ws, fail("bad", "That message was not understood."));
    try {
      const next = act(room, rulesetFor(room.ruleset), seat, msg);
      if (next === room) return;
      await this.save(next);
      this.broadcast(next);
      await this.archive(room, next);
    } catch (e) {
      if (!(e instanceof RoomError)) throw e;
      send(ws, fail(e.code, e.message));
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
    if (room) this.broadcast(room, ws);
  }

  override async webSocketError(ws: WebSocket): Promise<void> {
    await this.webSocketClose(ws);
  }

  /** Retention: the room and its game are deleted. */
  override async alarm(): Promise<void> {
    for (const ws of this.ctx.getWebSockets()) ws.close(4002, "room expired");
    this.room = undefined;
    await this.ctx.storage.deleteAll();
  }
}

interface Waiting {
  ticket: string;
  ruleset: string;
  lock: Lock;
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
    let lock: Lock | undefined;
    try {
      const value: unknown =
        typeof data === "string" && data.length <= MAX_BODY && JSON.parse(data);
      lock = parseLock(value);
    } catch {
      lock = undefined;
    }
    if (!lock) return send(ws, fail("bad", "That message was not understood."));
    try {
      // Check the setup now, so a bad one never reaches a room.
      createRoom("check", rulesetFor(lock.ruleset), lock, ticket);
      const key = `${lock.ruleset.id}@${lock.ruleset.version}`;
      const { queue, pair } = seek(await this.queue(), { ticket, ruleset: key, lock });
      await this.ctx.storage.put("queue", queue);
      if (!pair) return send(ws, { type: "seeking" });
      const [first, second] = pair;
      const opened = await openRoom(this.env, first.lock);
      const joined = await enterRoom(this.env, opened.room, second.lock);
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

  override async webSocketClose(ws: WebSocket): Promise<void> {
    const ticket = this.ctx.getTags(ws)[0]!;
    await this.ctx.storage.put("queue", leave(await this.queue(), ticket));
  }
}

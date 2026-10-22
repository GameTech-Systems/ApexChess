import { describe, expect, it } from "vitest";
import { catalog, resolveRuleset } from "@apexchess/engine";
import {
  EVENT_MAX,
  EVENT_MIN,
  createEvent,
  eventState,
  eventView,
  joinEvent,
  openBoards,
  parseEventRequest,
  recordResult,
  startEvent,
  withRoom,
  type EventData,
  type EventRequest,
} from "./event";
import { PROTOCOL } from "./protocol";
import { RoomError } from "./room";

const ruleset = resolveRuleset(catalog, "standard");
const ref = { id: ruleset.id, version: ruleset.version };
const req = (name: string, over: Partial<EventRequest> = {}): EventRequest => ({
  protocol: PROTOCOL,
  ruleset: ref,
  name,
  ...over,
});
const coin = (value: number) => () => value;

function code(fn: () => unknown): string | undefined {
  try {
    fn();
  } catch (e) {
    if (e instanceof RoomError) return e.code;
    throw e;
  }
  return undefined;
}

/** An event with `n` players named p0… holding tokens t0…. */
function withPlayers(n: number, tc?: string): EventData {
  let ev = createEvent("EVT234", ruleset, req("p0", tc ? { timeControl: tc } : {}), "t0");
  for (let i = 1; i < n; i++) ev = joinEvent(ev, ruleset, req(`p${i}`), `t${i}`);
  return ev;
}

/** Give every open board a room, as the server does. */
function seat(ev: EventData): EventData {
  for (const b of openBoards(ev))
    ev = withRoom(ev, b, `R${b.round}${b.board}`, [
      `l${b.round}${b.board}`,
      `d${b.round}${b.board}`,
    ]);
  return ev;
}

/** Play the event to its end: light wins every game. */
function playOut(ev: EventData): EventData {
  while (eventState(ev) === "playing") {
    ev = seat(ev);
    const round = ev.games.length - 1;
    ev.games[round]!.forEach((g, board) => {
      if (!g.score) ev = recordResult(ev, { round, board }, [1, 0]);
    });
  }
  return ev;
}

describe("creating and joining an event (D20)", () => {
  it("makes the creator the host and first player, on a clocked time control", () => {
    const ev = createEvent("EVT234", ruleset, req(" Host  One "), "t0");
    expect(ev.players).toEqual([{ name: "Host One", token: "t0" }]);
    expect(ev.timeControl).toBe("10+0");
    expect(ev.ruleset).toEqual(ref);
    expect(eventState(ev)).toBe("open");
    expect(createEvent("E", ruleset, req("ab", { timeControl: "move1d" }), "t").timeControl).toBe(
      "move1d",
    );
  });

  it("refuses untimed and leave-only controls, other versions, old pages, and bad names", () => {
    expect(code(() => createEvent("E", ruleset, req("ab", { timeControl: "untimed" }), "t"))).toBe(
      "timeControl",
    );
    expect(code(() => createEvent("E", ruleset, req("ab", { timeControl: "away5m" }), "t"))).toBe(
      "timeControl",
    );
    expect(
      code(() =>
        createEvent("E", ruleset, req("ab", { ruleset: { ...ref, version: "9.9.9" } }), "t"),
      ),
    ).toBe("ruleset");
    expect(code(() => createEvent("E", ruleset, req("ab", { protocol: 0 }), "t"))).toBe("protocol");
    expect(code(() => createEvent("E", ruleset, req("admin"), "t"))).toBe("name");
  });

  it(`takes up to ${EVENT_MAX} players with names unique in the event`, () => {
    const ev = withPlayers(3);
    expect(ev.players.map((p) => p.name)).toEqual(["p0", "p1", "p2"]);
    expect(code(() => joinEvent(ev, ruleset, req("P-1"), "x"))).toBe("name");
    expect(code(() => joinEvent(withPlayers(EVENT_MAX), ruleset, req("late"), "x"))).toBe("full");
    expect(code(() => joinEvent(ev, ruleset, req("ab", { protocol: 0 }), "x"))).toBe("protocol");
  });
});

describe("starting an event", () => {
  it(`only the host starts it, with at least ${EVENT_MIN} players; then nobody joins`, () => {
    expect(code(() => startEvent(withPlayers(EVENT_MIN - 1), "t0", coin(0.1)))).toBe("players");
    expect(code(() => startEvent(withPlayers(4), "t1", coin(0.1)))).toBe("host");
    const ev = startEvent(withPlayers(4), "t0", coin(0.1));
    expect(eventState(ev)).toBe("playing");
    expect(code(() => joinEvent(ev, ruleset, req("late"), "x"))).toBe("started");
    expect(code(() => startEvent(ev, "t0", coin(0.1)))).toBe("started");
  });

  it("round robin up to 8 players, Swiss with ceil(log2 n) + 1 rounds above", () => {
    expect(startEvent(withPlayers(4), "t0", coin(0.1))).toMatchObject({
      format: "roundRobin",
      rounds: 3,
    });
    expect(startEvent(withPlayers(7), "t0", coin(0.1))).toMatchObject({
      format: "roundRobin",
      rounds: 7,
    });
    expect(startEvent(withPlayers(8), "t0", coin(0.1)).rounds).toBe(7);
    expect(startEvent(withPlayers(9), "t0", coin(0.1))).toMatchObject({
      format: "swiss",
      rounds: 5,
    });
  });

  it("pairs round 1 at once; a bye is scored straight away", () => {
    const ev = startEvent(withPlayers(5), "t0", coin(0.1));
    expect(ev.games).toHaveLength(1);
    const bye = ev.games[0]!.find((g) => g.dark === undefined)!;
    expect(bye.score).toEqual([1, 0]);
    expect(openBoards(ev)).toHaveLength(2);
  });
});

describe("playing an event", () => {
  it("gives each player a ticket to their own game, and nothing of anyone else's", () => {
    const ev = seat(startEvent(withPlayers(4), "t0", coin(0.1)));
    expect(openBoards(ev)).toEqual([]);
    const game = ev.games[0]![0]!;
    const light = eventView(ev, `t${game.light}`);
    expect(light.you).toBe(game.light);
    expect(light.ticket).toEqual({ room: "R00", token: "l00" });
    expect(eventView(ev, `t${game.dark}`).ticket).toEqual({ room: "R00", token: "d00" });
    const visitor = eventView(ev);
    expect(visitor.you).toBeUndefined();
    expect(visitor.ticket).toBeUndefined();
    const text = JSON.stringify(visitor);
    for (const secret of ["t0", "t1", "l00", "d00", "R00"])
      expect(text).not.toContain(`"${secret}"`);
    expect(visitor.players).toEqual(["p0", "p1", "p2", "p3"]);
    expect(eventView(ev, "t0").host).toBe(true);
    expect(eventView(ev, "t1").host).toBe(false);
  });

  it("records each result once and pairs the next round when the last board finishes", () => {
    let ev = seat(startEvent(withPlayers(4), "t0", coin(0.1)));
    ev = recordResult(ev, { round: 0, board: 0 }, [1, 0]);
    expect(recordResult(ev, { round: 0, board: 0 }, [0, 1])).toBe(ev);
    expect(recordResult(ev, { round: 0, board: 9 }, [0, 1])).toBe(ev);
    expect(recordResult(ev, { round: 3, board: 0 }, [0, 1])).toBe(ev);
    expect(ev.games).toHaveLength(1);
    ev = recordResult(ev, { round: 0, board: 1 }, [0.5, 0.5]);
    expect(ev.games).toHaveLength(2);
    expect(openBoards(ev).map((b) => b.round)).toEqual([1, 1]);
    // A finished game gives no ticket; the next one does once its room exists.
    expect(eventView(ev, "t0").ticket).toBeUndefined();
    expect(eventView(seat(ev), "t0").ticket?.room).toMatch(/^R1/);
  });

  it("ends after the last round, with standings by score and Sonneborn-Berger", () => {
    const ev = playOut(startEvent(withPlayers(5), "t0", coin(0.1)));
    expect(eventState(ev)).toBe("over");
    expect(ev.games).toHaveLength(5);
    const view = eventView(ev);
    expect(view.state).toBe("over");
    expect(view.standings).toHaveLength(5);
    // Ten games of one point and five byes: fifteen points in all.
    expect(view.standings.reduce((s, x) => s + x.score, 0)).toBe(15);
    expect(view.games.flat().every((g) => g.score)).toBe(true);
  });

  it("runs a whole Swiss event with no repeat pairings", () => {
    const ev = playOut(startEvent(withPlayers(11), "t0", coin(0.9)));
    expect(ev.games).toHaveLength(5);
    const met = new Set<string>();
    for (const g of ev.games.flat())
      if (g.dark !== undefined) {
        const k = [g.light, g.dark].sort().join("-");
        expect(met.has(k)).toBe(false);
        met.add(k);
      }
    expect(eventView(ev).standings[0]!.tiebreak).toBeGreaterThan(0);
  });
});

describe("parsing event requests", () => {
  it("copies known fields and refuses odd shapes", () => {
    const r = req("ab", { timeControl: "3+2" });
    expect(parseEventRequest({ ...r, extra: 1 })).toEqual(r);
    expect(parseEventRequest(req("ab"))).toEqual(req("ab"));
    expect(parseEventRequest({ ...r, name: 5 })).toBeUndefined();
    expect(parseEventRequest({ ...r, name: "x".repeat(200) })).toBeUndefined();
    expect(parseEventRequest({ ...r, ruleset: "standard" })).toBeUndefined();
    expect(parseEventRequest(null)).toBeUndefined();
  });
});

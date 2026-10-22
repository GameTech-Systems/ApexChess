import { describe, expect, it } from "vitest";
import {
  catalog,
  legalMoves,
  mirrorSetup,
  moveText,
  replay,
  resolveRuleset,
} from "@apexchess/engine";
import { ARCHIVE_FORMAT, archiveRecord, archiveRow } from "./archive";
import { PROTOCOL, type Lock } from "./protocol";
import { act, createRoom, joinRoom, sideOf, type RoomData } from "./room";

const ruleset = resolveRuleset(catalog, "standard");
const first = catalog.setups[0]!.pieces;
const second = mirrorSetup(ruleset.board, "light", first);
const lock = (setup: Lock["setup"]): Lock => ({
  protocol: PROTOCOL,
  ruleset: { id: ruleset.id, version: ruleset.version },
  setup,
});
const started = (): RoomData =>
  joinRoom(
    createRoom("ABC234", ruleset, lock(first), "seat-zero-token"),
    ruleset,
    lock(second),
    "seat-one-token",
    () => 0.9,
  );
const toMove = (room: RoomData) =>
  sideOf(room, 0) === replay(ruleset, room.record!).position.turn ? 0 : 1;
function play(room: RoomData, plies: number): RoomData {
  for (let i = 0; i < plies; i++) {
    const move = moveText(legalMoves(ruleset, replay(ruleset, room.record!).position)[0]!);
    room = act(room, ruleset, toMove(room), { type: "move", move, ply: i });
  }
  return room;
}
// 23:59:59 UTC; the record keeps only the day.
const NOW = Date.UTC(2026, 9, 22, 23, 59, 59);

describe("archive record", () => {
  it("is made once, when a game ends, with game data and the day only", () => {
    const before = play(started(), 3);
    const after = act(before, ruleset, toMove(before), { type: "resign" });
    const rec = archiveRecord(before, after, NOW)!;
    expect(rec).toEqual({
      format: ARCHIVE_FORMAT,
      ruleset: { id: ruleset.id, version: ruleset.version },
      setups: after.record!.setups,
      moves: after.record!.moves,
      end: after.end,
      endDay: "2026-10-22",
    });
    expect(rec.moves).toHaveLength(3);
    const text = JSON.stringify(rec);
    for (const secret of ["ABC234", "seat-zero-token", "seat-one-token", "23:59"])
      expect(text).not.toContain(secret);
  });

  it("is not made while a game goes on, after it is over, or when a rematch starts", () => {
    const playing = play(started(), 2);
    expect(archiveRecord(started(), playing, NOW)).toBeUndefined();
    const over = act(playing, ruleset, 0, { type: "resign" });
    const offered = act(over, ruleset, 1, { type: "rematch" });
    expect(archiveRecord(over, offered, NOW)).toBeUndefined();
    const rematch = act(offered, ruleset, 0, { type: "rematch" });
    expect(archiveRecord(offered, rematch, NOW)).toBeUndefined();
    // The rematch is its own game and is archived when it ends.
    const ended = act(rematch, ruleset, 1, { type: "resign" });
    expect(archiveRecord(rematch, ended, NOW)?.moves).toEqual([]);
  });

  it("covers draws by agreement", () => {
    const offered = act(started(), ruleset, 0, { type: "offerDraw" });
    const agreed = act(offered, ruleset, 1, { type: "offerDraw" });
    expect(archiveRecord(offered, agreed, NOW)?.end).toEqual({
      status: "draw",
      reason: "agreement",
    });
  });
});

describe("archive row", () => {
  const before = play(started(), 1);
  const rec = archiveRecord(before, act(before, ruleset, 0, { type: "resign" }), NOW)!;

  it("flattens the record into columns, with setups and moves as JSON", () => {
    const row = archiveRow(rec);
    expect(row).toEqual({
      format: ARCHIVE_FORMAT,
      ruleset_id: ruleset.id,
      ruleset_version: ruleset.version,
      setup_light: JSON.stringify(rec.setups.light),
      setup_dark: JSON.stringify(rec.setups.dark),
      moves: JSON.stringify(rec.moves),
      plies: 1,
      status: "resigned",
      winner: rec.end.status === "resigned" ? rec.end.winner : null,
      reason: null,
      end_day: "2026-10-22",
    });
  });

  it("keeps the draw reason and no winner for a draw", () => {
    const row = archiveRow({ ...rec, end: { status: "draw", reason: "agreement" } });
    expect(row.winner).toBeNull();
    expect(row.reason).toBe("agreement");
  });
});

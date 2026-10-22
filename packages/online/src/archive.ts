/**
 * Anonymous game archive (S19a, D18 default, provisional; see docs/decisions/0006). One record per
 * finished online game: game data and the day it ended, never a seat token, room code, address, or
 * time of day. The server writes it once, when a game ends.
 */
import type { Pieces } from "@apexchess/engine";
import type { End, RulesetRef } from "./protocol";
import type { RoomData } from "./room";

/** Bump when the record's shape changes; old rows keep their number. */
export const ARCHIVE_FORMAT = 2;

export interface ArchiveRecord {
  format: number;
  ruleset: RulesetRef;
  /** Written for light, as in the game record. */
  setups: { light: Pieces; dark: Pieces };
  moves: string[];
  end: End;
  /** UTC day the game ended, `YYYY-MM-DD`. */
  endDay: string;
  /** Time control id (D19; format 2). Clock times are not kept. */
  timeControl: string;
}

export type ArchiveRow = Record<string, string | number | null>;

/** The record for the game that `before` → `after` just ended, or undefined if no game ended. */
export function archiveRecord(
  before: RoomData,
  after: RoomData,
  now: number,
): ArchiveRecord | undefined {
  const { record, end } = after;
  if (!record || !end || before.end) return undefined;
  return {
    format: ARCHIVE_FORMAT,
    ruleset: { id: record.ruleset.id, version: record.ruleset.version },
    setups: { light: record.setups.light, dark: record.setups.dark },
    moves: [...record.moves],
    end,
    endDay: new Date(now).toISOString().slice(0, 10),
    timeControl: after.timeControl,
  };
}

/** The record as table columns, in the order of `apps/server/migrations/` 0001 then 0003. */
export function archiveRow(rec: ArchiveRecord): ArchiveRow {
  return {
    format: rec.format,
    ruleset_id: rec.ruleset.id,
    ruleset_version: rec.ruleset.version,
    setup_light: JSON.stringify(rec.setups.light),
    setup_dark: JSON.stringify(rec.setups.dark),
    moves: JSON.stringify(rec.moves),
    plies: rec.moves.length,
    status: rec.end.status,
    winner: rec.end.status === "draw" ? null : rec.end.winner,
    reason: rec.end.status === "draw" ? rec.end.reason : null,
    end_day: rec.endDay,
    time_control: rec.timeControl,
  };
}

/**
 * Time controls (D19, docs/decisions/0007). The presets are data in `rules/timeControls.json`. The
 * server keeps the clock; every function here takes the time as `now` (ms), so it is pure.
 */
import { insufficientMaterial, type Position, type ResolvedRuleset, type Side } from "@apexchess/engine";
import data from "../../../rules/timeControls.json";
import type { End } from "./protocol";

export type TimeControl = { id: string; label: string } & (
  | { kind: "untimed" }
  | { kind: "fischer"; initialSeconds: number; incrementSeconds: number }
  | { kind: "perMove"; seconds: number }
  | { kind: "abandonment"; graceSeconds: number }
);

export const TIME_CONTROLS = data.controls as TimeControl[];
export const DEFAULT_TIME_CONTROL: string = data.default;

export const timeControl = (id: string): TimeControl | undefined =>
  TIME_CONTROLS.find((c) => c.id === id);

if (!timeControl(DEFAULT_TIME_CONTROL))
  throw new Error(`rules/timeControls.json: default ${DEFAULT_TIME_CONTROL} is not a control`);

/** Both sides' time left (ms) when the running side's turn began at `since`. */
export interface ClockData {
  light: number;
  dark: number;
  running: Side;
  since: number;
}

const opposite = (side: Side): Side => (side === "light" ? "dark" : "light");

/** The clock at the start of a game, or undefined when the control has none. It runs from the start. */
export function startClock(tc: TimeControl, first: Side, now: number): ClockData | undefined {
  const ms =
    tc.kind === "fischer" ? tc.initialSeconds * 1000 : tc.kind === "perMove" ? tc.seconds * 1000 : 0;
  return ms ? { light: ms, dark: ms, running: first, since: now } : undefined;
}

/** When the running side's flag falls. */
export const clockDeadline = (clock: ClockData) => clock.since + clock[clock.running];

/** Time left for each side at `now`, never below 0. */
export function clockLeft(clock: ClockData, now: number): { light: number; dark: number } {
  const used = Math.max(0, now - clock.since);
  const left = { light: clock.light, dark: clock.dark };
  left[clock.running] = Math.max(0, left[clock.running] - used);
  return left;
}

/** The clock after the running side moves at `now` (before its deadline). */
export function clockAfterMove(tc: TimeControl, clock: ClockData, now: number): ClockData {
  const mover = clock.running;
  const next = { ...clock, running: opposite(mover), since: now };
  next[mover] =
    tc.kind === "perMove"
      ? tc.seconds * 1000
      : clockLeft(clock, now)[mover] + (tc.kind === "fischer" ? tc.incrementSeconds * 1000 : 0);
  return next;
}

/**
 * The end when `loser` runs out of time or abandons the game: a loss, or a draw when the opponent
 * could not checkmate under D8's insufficient-material test applied to the opponent's pieces alone.
 */
export function timeoutEnd(
  ruleset: ResolvedRuleset,
  pos: Position,
  loser: Side,
  reason: "time" | "abandoned",
): End {
  const winner = opposite(loser);
  const winnerOnly = Object.fromEntries(
    Object.entries(pos.squares).filter(
      ([, p]) => p.side === winner || ruleset.pieces.pieces[p.piece]?.royal,
    ),
  );
  return insufficientMaterial(ruleset, { ...pos, squares: winnerOnly })
    ? { status: "draw", reason }
    : { status: reason, winner };
}

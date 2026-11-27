import {
  checkSetup,
  decodeSetup,
  placeSetup,
  startPosition,
  type Move,
  type Pieces,
  type Position,
  type ResolvedRuleset,
  type Side,
} from "@apexchess/engine";
import data from "./lessons.json";
import type { Level } from "./computer";

/** Lesson positions are data (`lessons.json`), in ordinary squares; "default" is both default setups. */
export type LessonPosition = "default" | { light: Pieces; dark: Pieces };

interface TaskBase {
  id: string;
  prompt: string;
  /** Shown once the answer is right. */
  done: string;
}
/** Click one of `answers`. */
export interface SquareTask extends TaskBase {
  kind: "square";
  position: LessonPosition;
  answers: string[];
  hint: string;
}
/** Play one of `answers`, "from-to"; "from-to=piece" names the promotion, otherwise any is right. */
export interface MoveTask extends TaskBase {
  kind: "move";
  position: LessonPosition;
  turn: Side;
  answers: string[];
  hint: string;
}
/** Pick the option at `answer`; each option is a setup code for light. */
export interface ChoiceTask extends TaskBase {
  kind: "choice";
  options: { label: string; setup: string }[];
  answer: number;
}
/** Build any legal arrangement. */
export interface SetupTask extends TaskBase {
  kind: "setup";
}
export type Task = SquareTask | MoveTask | ChoiceTask | SetupTask;

export interface Lesson {
  id: string;
  title: string;
  text: string[];
  tasks: Task[];
}

export const tutorial = data as {
  ruleset: { id: string; version: string };
  source: string;
  lessons: Lesson[];
};
export const lessons = tutorial.lessons;

/** The tutorial ends with a game against the weakest computer level (the first one listed). */
export const EASIEST_LEVEL: Level = "random";

/**
 * The task's position. Lesson positions are mid-game (ply 2, nothing unmoved) so first-move
 * parameters stay out of the way; the default position is a fresh game.
 */
export function lessonPosition(ruleset: ResolvedRuleset, task: SquareTask | MoveTask): Position {
  const def = ruleset.setup.default.pieces;
  if (task.position === "default") return startPosition(ruleset, def, def);
  const squares: Position["squares"] = {};
  for (const side of ["light", "dark"] as const)
    for (const [sq, piece] of Object.entries(task.position[side])) squares[sq] = { side, piece };
  return {
    squares,
    turn: task.kind === "move" ? task.turn : ruleset.firstToMove,
    ply: 2,
    unmoved: [],
  };
}

export function judgeSquare(task: SquareTask, square: string): boolean {
  return task.answers.includes(square);
}

/** Whether a legal move is one of the task's answers. */
export function judgeMove(_ruleset: ResolvedRuleset, task: MoveTask, move: Move): boolean {
  return task.answers.some((a) => {
    const [path, promotion] = a.split("=");
    return path === `${move.from}-${move.to}` && (!promotion || promotion === move.promotion);
  });
}

/** The option's pieces, written for light. */
export function optionPieces(ruleset: ResolvedRuleset, code: string): Pieces {
  return decodeSetup(ruleset, code);
}

/** Right or wrong; a wrong pick says why, in the engine's words. */
export function judgeChoice(
  ruleset: ResolvedRuleset,
  task: ChoiceTask,
  index: number,
): { right: boolean; why: string } {
  const option = task.options[index]!;
  const errors = checkSetup(ruleset, "light", optionPieces(ruleset, option.setup));
  if (index === task.answer) return { right: errors.length === 0, why: "" };
  return {
    right: false,
    why: errors.length
      ? `${option.label} breaks a rule: ${errors.map((e) => e.message).join("; ")}.`
      : `${option.label} is legal too, but it is not the answer.`,
  };
}

/** A built arrangement is right when it can be played. */
export function judgeSetup(ruleset: ResolvedRuleset, pieces: Pieces): boolean {
  return checkSetup(ruleset, "light", pieces).length === 0;
}

/** An option's arrangement on the board, light's pieces only. */
export function optionPosition(ruleset: ResolvedRuleset, code: string): Position {
  const squares: Position["squares"] = {};
  for (const [sq, piece] of Object.entries(
    placeSetup(ruleset.board, "light", optionPieces(ruleset, code)),
  ))
    squares[sq] = { side: "light", piece };
  return { squares, turn: "light", ply: 0, unmoved: [] };
}

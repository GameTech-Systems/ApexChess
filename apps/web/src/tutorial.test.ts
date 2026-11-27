import { describe, expect, it } from "vitest";
import {
  catalog,
  chordOf,
  checkSetup,
  decodeSetup,
  inCheck,
  legalMoves,
  makeMove,
  moveText,
  resolveRuleset,
} from "@apexchess/engine";
import { emptySetup } from "./setupBuilder";
import {
  EASIEST_LEVEL,
  judgeChoice,
  judgeMove,
  judgeSetup,
  judgeSquare,
  lessonPosition,
  lessons,
  tutorial,
  type MoveTask,
} from "./tutorial";
import { levels } from "./computer";

const ruleset = resolveRuleset(catalog, tutorial.ruleset.id, tutorial.ruleset.version);
const tasks = lessons.flatMap((l) => l.tasks.map((t) => ({ lesson: l.id, ...t })));
const moveTasks = tasks.filter((t): t is MoveTask & { lesson: string } => t.kind === "move");
const legal = (t: MoveTask) => legalMoves(ruleset, lessonPosition(ruleset, t));
const accepted = (t: MoveTask) =>
  legal(t)
    .filter((m) => judgeMove(ruleset, t, m))
    .map(moveText)
    .sort();
const byId = (id: string) => tasks.find((t) => t.id === id)!;

describe("tutorial data", () => {
  it("teaches the live official ruleset", () => {
    const live = resolveRuleset(catalog, "standard");
    expect(tutorial.ruleset).toEqual({ id: live.id, version: live.version });
    expect(live.status).toBe("official");
  });
  it("has the five lessons in order, each with a task, and unique task ids", () => {
    expect(lessons.map((l) => l.id)).toEqual(["board", "lines", "pawns", "check", "setup"]);
    for (const l of lessons) expect(l.tasks.length).toBeGreaterThan(0);
    expect(new Set(tasks.map((t) => t.id)).size).toBe(tasks.length);
  });
  it("starts every position legally: the side not to move is not in check", () => {
    for (const t of tasks) {
      if (t.kind !== "move" && t.kind !== "square") continue;
      const pos = lessonPosition(ruleset, t);
      expect(inCheck(ruleset, pos, pos.turn === "light" ? "dark" : "light"), t.id).toBe(false);
    }
  });
  it("lists only legal moves as answers", () => {
    for (const t of moveTasks) {
      const texts = new Set(legal(t).map((m) => `${m.from}-${m.to}`));
      for (const a of t.answers) expect(texts.has(a.slice(0, 5)), `${t.id} ${a}`).toBe(true);
    }
  });
  it("plays the easiest computer at the end", () => {
    expect(EASIEST_LEVEL).toBe(Object.keys(levels)[0]);
  });
});

describe("each lesson accepts only its legal answers", () => {
  it("board: the king corners come from the board data", () => {
    const light = byId("light-corner");
    const dark = byId("dark-corner");
    for (const sq of ["h1", "a8", "a1", "h8", "e4"]) {
      expect(judgeSquare(light as never, sq)).toBe(sq === ruleset.board.sides.light.corner);
      expect(judgeSquare(dark as never, sq)).toBe(sq === ruleset.board.sides.dark.corner);
    }
  });
  it("lines: the bishop's chord, its ray ahead, and the rook's file", () => {
    const chord = byId("bishop-chord") as MoveTask;
    const from = "e3";
    const onChord = legal(chord)
      .filter(
        (m) =>
          m.from === from &&
          chordOf(ruleset.board, "light", m.to) === chordOf(ruleset.board, "light", from),
      )
      .map(moveText)
      .sort();
    expect(onChord.length).toBe(5);
    expect(accepted(chord)).toEqual(onChord);
    expect(accepted(byId("bishop-ray") as MoveTask)).toEqual(
      ["e3-a7", "e3-b6", "e3-c5", "e3-d4"].sort(),
    );
    expect(accepted(byId("rook-file") as MoveTask)).toEqual(["d4xd7"]);
  });
  it("pawns: ahead, forward to the side, along the far edge, and promotion on the corner", () => {
    expect(accepted(byId("pawn-step") as MoveTask)).toEqual(["h5-g6"]);
    expect(accepted(byId("pawn-capture") as MoveTask)).toEqual(["h5xh6"]);
    expect(accepted(byId("pawn-edge") as MoveTask)).toEqual(["d8-c8"]);
    const promo = byId("pawn-promote") as MoveTask;
    expect(accepted(promo)).toEqual(
      ruleset.pieces.pieces.pawn!.promotesTo!.map((p) => `b8-a8=${p}`).sort(),
    );
    expect(ruleset.board.sides.light.promotionSquares).toEqual(["a8"]);
  });
  it("check: the answers are exactly the engine's checking and mating moves", () => {
    const check = byId("give-check") as MoveTask;
    const checking = legal(check)
      .filter((m) => inCheck(ruleset, makeMove(lessonPosition(ruleset, check), m)))
      .map(moveText)
      .sort();
    expect(checking.length).toBeGreaterThan(0);
    expect(accepted(check)).toEqual(checking);
    const mate = byId("mate-in-one") as MoveTask;
    const pos = lessonPosition(ruleset, mate);
    const mating = legal(mate)
      .filter((m) => {
        const next = makeMove(pos, m);
        return inCheck(ruleset, next) && legalMoves(ruleset, next).length === 0;
      })
      .map(moveText)
      .sort();
    expect(mating).toEqual(["b1-b7"]);
    expect(accepted(mate)).toEqual(mating);
  });
  it("setup: the one legal arrangement is the answer, and errors come from the engine", () => {
    const choice = byId("pick-setup");
    if (choice.kind !== "choice") throw new Error("pick-setup is a choice");
    const legalOptions = choice.options
      .map((o, i) => (checkSetup(ruleset, "light", decodeSetup(ruleset, o.setup)).length ? -1 : i))
      .filter((i) => i >= 0);
    expect(legalOptions).toEqual([choice.answer]);
    choice.options.forEach((_, i) => {
      const verdict = judgeChoice(ruleset, choice, i);
      expect(verdict.right).toBe(i === choice.answer);
      if (!verdict.right) expect(verdict.why.length).toBeGreaterThan(0);
    });
    const build = byId("build-setup");
    if (build.kind !== "setup") throw new Error("build-setup is a setup");
    expect(judgeSetup(ruleset, ruleset.setup.default.pieces)).toBe(true);
    expect(judgeSetup(ruleset, emptySetup(ruleset))).toBe(false);
    expect(judgeSetup(ruleset, decodeSetup(ruleset, "K/BR/RQB/PPPP/PPN1P/4PN"))).toBe(false);
  });
});

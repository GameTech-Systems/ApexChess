import { useMemo, useState } from "react";
import {
  inCheck,
  legalMoves,
  makeMove,
  type Move,
  type Pieces,
  type ResolvedRuleset,
} from "@apexchess/engine";
import { Board } from "./Board";
import { levels } from "./computer";
import { promotionChoices, targetsFrom } from "./hotseat";
import { PageHead } from "./Page";
import type { KeyValueStore } from "./savedSetups";
import { SetupBuilder } from "./SetupBuilder";
import { emptySetup } from "./setupBuilder";
import {
  EASIEST_LEVEL,
  judgeChoice,
  judgeMove,
  judgeSetup,
  judgeSquare,
  lessonPosition,
  lessons,
  optionPosition,
  type ChoiceTask,
  type MoveTask,
  type SetupTask,
  type SquareTask,
  type Task,
} from "./tutorial";

interface At {
  lesson: number;
  task: number;
}

/** What a task view reports: a wrong try (with why) or the right answer. */
type Report = (right: boolean, why?: string) => void;

/**
 * Five short lessons on a live board, then a game against the easiest computer. Lesson text,
 * positions, and answers are data (`lessons.json`); the engine decides what is legal.
 */
export function Tutorial({
  ruleset,
  store,
  onPlay,
  onClose,
  initial = { lesson: 0, task: 0 },
}: {
  ruleset: ResolvedRuleset;
  store: KeyValueStore;
  /** Start a game against the easiest computer, both sides in the default setup. */
  onPlay: () => void;
  onClose?: () => void;
  /** Where to open; a lesson past the last is the closing screen. */
  initial?: At;
}) {
  const [at, setAt] = useState<At>(initial);
  const [solved, setSolved] = useState(false);
  const [feedback, setFeedback] = useState<string>();
  const go = (next: At) => {
    setAt(next);
    setSolved(false);
    setFeedback(undefined);
  };
  const lesson = lessons[at.lesson];
  const task = lesson?.tasks[at.task];
  const lastTask = lesson ? at.task === lesson.tasks.length - 1 : false;
  const next = () =>
    go(lastTask ? { lesson: at.lesson + 1, task: 0 } : { lesson: at.lesson, task: at.task + 1 });
  const report: Report = (right, why) => {
    if (right) {
      setSolved(true);
      setFeedback(task!.done);
    } else setFeedback(why);
  };

  return (
    <section className="tutorial" aria-label="Tutorial">
      <PageHead title="Tutorial" onBack={onClose} />
      <nav aria-label="Lessons">
        <ol className="lesson-list">
          {lessons.map((l, i) => (
            <li key={l.id}>
              <button
                type="button"
                className="link"
                aria-current={i === at.lesson ? "step" : undefined}
                onClick={() => go({ lesson: i, task: 0 })}
              >
                {l.title}
              </button>
            </li>
          ))}
          <li>
            <button
              type="button"
              className="link"
              aria-current={at.lesson >= lessons.length ? "step" : undefined}
              onClick={() => go({ lesson: lessons.length, task: 0 })}
            >
              Play a game
            </button>
          </li>
        </ol>
      </nav>

      {!lesson || !task ? (
        <div className="lesson">
          <h2>Play a game</h2>
          <p>
            You have seen every rule. Try them in a game against the computer at its easiest
            strength, both armies in the default setup. You play light and move first.
          </p>
          <button type="button" className="primary" onClick={onPlay}>
            Play the computer ({levels[EASIEST_LEVEL].label})
          </button>
        </div>
      ) : (
        <div className="lesson">
          <p className="lesson-count">
            Lesson {at.lesson + 1} of {lessons.length}
          </p>
          <h2>{lesson.title}</h2>
          {lesson.text.map((t) => (
            <p key={t}>{t}</p>
          ))}
          <h3>
            Task {at.task + 1} of {lesson.tasks.length}
          </h3>
          <p className="prompt">{task.prompt}</p>
          <TaskView
            key={`${lesson.id}-${task.id}`}
            ruleset={ruleset}
            store={store}
            task={task}
            solved={solved}
            report={report}
          />
          <p role="status" className={solved ? "feedback right" : "feedback"}>
            {feedback}
          </p>
          {solved && (
            <button type="button" className="primary" onClick={next}>
              {lastTask
                ? at.lesson === lessons.length - 1
                  ? "Finish"
                  : "Next lesson"
                : "Next task"}
            </button>
          )}
        </div>
      )}
    </section>
  );
}

function TaskView(props: {
  ruleset: ResolvedRuleset;
  store: KeyValueStore;
  task: Task;
  solved: boolean;
  report: Report;
}) {
  const { task } = props;
  if (task.kind === "square") return <SquareView {...props} task={task} />;
  if (task.kind === "move") return <MoveView {...props} task={task} />;
  if (task.kind === "choice") return <ChoiceView {...props} task={task} />;
  return <SetupView {...props} task={task} />;
}

function SquareView({
  ruleset,
  task,
  solved,
  report,
}: {
  ruleset: ResolvedRuleset;
  task: SquareTask;
  solved: boolean;
  report: Report;
}) {
  const [picked, setPicked] = useState<string>();
  const position = useMemo(() => lessonPosition(ruleset, task), [ruleset, task]);
  return (
    <Board
      board={ruleset.board}
      position={position}
      view="light"
      pieceSet={ruleset.pieces}
      selected={picked}
      label="Lesson board"
      onSquareClick={(sq) => {
        if (solved) return;
        setPicked(sq);
        const right = judgeSquare(task, sq);
        report(right, right ? undefined : `Not ${sq}. ${task.hint}`);
      }}
    />
  );
}

function MoveView({
  ruleset,
  task,
  solved,
  report,
}: {
  ruleset: ResolvedRuleset;
  task: MoveTask;
  solved: boolean;
  report: Report;
}) {
  const start = useMemo(() => lessonPosition(ruleset, task), [ruleset, task]);
  const [played, setPlayed] = useState<Move>();
  const [selected, setSelected] = useState<string>();
  const [pending, setPending] = useState<{ from: string; to: string; choices: string[] }>();
  const pos = played ? makeMove(start, played) : start;
  const moves = useMemo(() => legalMoves(ruleset, start), [ruleset, start]);
  const targets = selected && !solved ? targetsFrom(moves, selected) : undefined;
  const checked =
    played && inCheck(ruleset, pos)
      ? Object.entries(pos.squares).find(
          ([, p]) => p.side === pos.turn && ruleset.pieces.pieces[p.piece]?.royal,
        )?.[0]
      : undefined;

  const attempt = (move: Move) => {
    setSelected(undefined);
    setPending(undefined);
    if (judgeMove(ruleset, task, move)) {
      setPlayed(move);
      report(true);
    } else report(false, `That move is legal, but not the one asked for. ${task.hint}`);
  };
  const onSquareClick = (sq: string) => {
    if (solved || pending) return;
    if (selected && targets?.has(sq)) {
      const choices = promotionChoices(moves, selected, sq);
      if (choices.length) return setPending({ from: selected, to: sq, choices });
      return attempt(moves.find((m) => m.from === selected && m.to === sq)!);
    }
    const own = start.squares[sq]?.side === start.turn && moves.some((m) => m.from === sq);
    setSelected(own && sq !== selected ? sq : undefined);
  };

  return (
    <>
      <Board
        board={ruleset.board}
        position={pos}
        view="light"
        pieceSet={ruleset.pieces}
        selected={selected}
        targets={targets}
        lastMove={played ? [played.from, played.to] : undefined}
        checked={checked}
        label="Lesson board"
        onSquareClick={onSquareClick}
      />
      {pending && (
        <div role="group" aria-label="Promote to" className="promo">
          {pending.choices.map((piece) => (
            <button
              key={piece}
              type="button"
              onClick={() =>
                attempt(
                  moves.find(
                    (m) => m.from === pending.from && m.to === pending.to && m.promotion === piece,
                  )!,
                )
              }
            >
              {piece}
            </button>
          ))}
        </div>
      )}
      {!solved && !pending && (
        <p className="hint">
          {selected
            ? "Dots show where the piece can go. Click one."
            : `Click a ${start.turn} piece to see where it can go.`}
        </p>
      )}
    </>
  );
}

function ChoiceView({
  ruleset,
  task,
  solved,
  report,
}: {
  ruleset: ResolvedRuleset;
  task: ChoiceTask;
  solved: boolean;
  report: Report;
}) {
  const [picked, setPicked] = useState<number>();
  return (
    <ul className="choices">
      {task.options.map((o, i) => (
        <li key={o.label} className={picked === i ? "picked" : undefined}>
          <Board
            board={ruleset.board}
            position={optionPosition(ruleset, o.setup)}
            view="light"
            pieceSet={ruleset.pieces}
            coordinates={false}
            label={`Arrangement ${o.label}: ${o.setup}`}
          />
          <button
            type="button"
            disabled={solved}
            aria-pressed={picked === i}
            onClick={() => {
              setPicked(i);
              const v = judgeChoice(ruleset, task, i);
              report(v.right, v.why);
            }}
          >
            Choose {o.label}
          </button>
        </li>
      ))}
    </ul>
  );
}

function SetupView({
  ruleset,
  store,
  report,
}: {
  ruleset: ResolvedRuleset;
  store: KeyValueStore;
  task: SetupTask;
  report: Report;
}) {
  const initial = useMemo<Pieces>(() => emptySetup(ruleset), [ruleset]);
  return (
    <SetupBuilder
      ruleset={ruleset}
      title="Your setup"
      presets={[]}
      store={store}
      initial={initial}
      side="light"
      doneLabel="Check my setup"
      onDone={(pieces) =>
        report(
          judgeSetup(ruleset, pieces),
          "That arrangement breaks a rule: check the messages above.",
        )
      }
    />
  );
}

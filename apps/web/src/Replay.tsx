import { useMemo, useState } from "react";
import {
  replay,
  result,
  type GameRecord,
  type ResolvedRuleset,
  type Side,
} from "@apexchess/engine";
import { Board } from "./Board";
import { DEFAULT_LEVEL, levels, type Level } from "./computer";
import { MoveList } from "./MoveList";
import { canPlayOn, resumeFrom, type Resume } from "./playOn";

/** Steps through a finished or shared game, move by move. */
export function Replay({
  ruleset,
  record,
  onClose,
  playOn,
}: {
  ruleset: ResolvedRuleset;
  record: GameRecord;
  onClose: () => void;
  /** With this, an imported or shared game can be carried on from the move shown (live ruleset only). */
  playOn?: {
    live: ResolvedRuleset;
    start: (resume: Resume, opponent: "hotseat" | "computer", level: Level) => void;
  };
}) {
  const [step, setStep] = useState(0);
  const [side, setSide] = useState<Side>("light");
  const [level, setLevel] = useState<Level>(DEFAULT_LEVEL);
  const [view, setView] = useState<Side>("light");
  const total = record.moves.length;
  const shown = useMemo(
    () => replay(ruleset, { ...record, moves: record.moves.slice(0, step) }),
    [ruleset, record, step],
  );
  const res = result(ruleset, shown);
  const last = step > 0 ? record.moves[step - 1]! : undefined;
  return (
    <section aria-label="Replay">
      <h2>Replay</h2>
      <Board
        board={ruleset.board}
        position={shown.position}
        view={view}
        pieceSet={ruleset.pieces}
        lastMove={last ? [last.slice(0, 2), last.slice(3, 5)] : undefined}
      />
      <p role="status" className="status">
        Move {step} of {total}
        {step === total && res.status === "checkmate" ? `. Checkmate. ${res.winner} wins.` : ""}
        {step === total && res.status === "draw" ? `. Draw by ${res.reason}.` : ""}
      </p>
      <div className="controls">
        <button type="button" onClick={() => setStep(0)} disabled={step === 0}>
          Start
        </button>
        <button type="button" onClick={() => setStep(step - 1)} disabled={step === 0}>
          Back
        </button>
        <button type="button" onClick={() => setStep(step + 1)} disabled={step === total}>
          Forward
        </button>
        <button type="button" onClick={() => setStep(total)} disabled={step === total}>
          End
        </button>
        <button type="button" onClick={() => setView(view === "light" ? "dark" : "light")}>
          Turn the board
        </button>
        <button type="button" onClick={onClose}>
          Close
        </button>
      </div>
      {playOn && canPlayOn(playOn.live, record, step) && (
        <section className="play-on" aria-label="Play on from here">
          <h3>Play on from here</h3>
          <p>
            Carry on from move {step}, with both players keeping their setups. This does not change
            the game you opened.
          </p>
          <button
            type="button"
            className="secondary"
            onClick={() => playOn.start(resumeFrom(record, step, side), "hotseat", level)}
          >
            Two players, one screen
          </button>{" "}
          <button
            type="button"
            className="secondary"
            onClick={() => playOn.start(resumeFrom(record, step, side), "computer", level)}
          >
            Play the computer
          </button>
          <div className="play-on-options">
            <label>
              Against the computer, you play{" "}
              <select value={side} onChange={(e) => setSide(e.target.value as Side)}>
                <option value="light">light</option>
                <option value="dark">dark</option>
              </select>
            </label>{" "}
            <label>
              Computer strength{" "}
              <select value={level} onChange={(e) => setLevel(e.target.value as Level)}>
                {Object.entries(levels).map(([id, l]) => (
                  <option key={id} value={id}>
                    {l.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>
      )}
      <MoveList
        moves={record.moves}
        first={ruleset.firstToMove}
        current={step}
        onSelect={setStep}
      />
    </section>
  );
}

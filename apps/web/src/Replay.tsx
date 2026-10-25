import { useMemo, useState } from "react";
import {
  replay,
  result,
  type GameRecord,
  type ResolvedRuleset,
  type Side,
} from "@apexchess/engine";
import { Board } from "./Board";
import { MoveList } from "./MoveList";

/** Steps through a finished or shared game, move by move. */
export function Replay({
  ruleset,
  record,
  onClose,
}: {
  ruleset: ResolvedRuleset;
  record: GameRecord;
  onClose: () => void;
}) {
  const [step, setStep] = useState(0);
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
      <MoveList
        moves={record.moves}
        first={ruleset.firstToMove}
        current={step}
        onSelect={setStep}
      />
    </section>
  );
}

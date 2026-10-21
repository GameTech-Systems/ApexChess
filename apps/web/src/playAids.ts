import {
  attackedSquares,
  type GameRecord,
  type Position,
  type ResolvedRuleset,
  type Side,
} from "@apexchess/engine";

/**
 * The record with the last move taken back. Against the computer, `humanParity` is the
 * parity of the human's turn index (0 if the human moves first); the computer's reply goes too.
 */
export function undoMoves(record: GameRecord, humanParity?: number): GameRecord {
  const n = record.moves.length;
  if (n === 0) return record;
  const drop = humanParity !== undefined && (n - 1) % 2 !== humanParity ? 2 : 1;
  return { ...record, moves: record.moves.slice(0, Math.max(0, n - drop)) };
}

/** Squares of `side`'s pieces that the opponent attacks and `side` does not defend. */
export function piecesInDanger(ruleset: ResolvedRuleset, pos: Position, side: Side): Set<string> {
  const enemy: Side = side === "light" ? "dark" : "light";
  const attacked = attackedSquares(ruleset, pos, enemy);
  const defended = attackedSquares(ruleset, pos, side);
  return new Set(
    Object.entries(pos.squares)
      .filter(([sq, p]) => p.side === side && attacked.has(sq) && !defended.has(sq))
      .map(([sq]) => sq),
  );
}

/** A short beep; silent where Web Audio is unavailable. */
export function playSound(kind: "move" | "capture" | "end"): void {
  try {
    const Ctx = window.AudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = { move: 440, capture: 220, end: 330 }[kind];
    gain.gain.value = 0.08;
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.1);
    osc.onended = () => void ctx.close();
  } catch {
    /* sound is optional */
  }
}

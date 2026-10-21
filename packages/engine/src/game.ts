/** Check, legal moves, and results. Royal pieces, draw thresholds, and dead material come from rules data. */
import { attackedSquares, generateMoves, moveText, type Move, type Position } from "./moves";
import type { DrawMode, ResolvedRuleset, Side } from "./rules";
import { parseSquare } from "./setup";

export type DrawReason = "stalemate" | "repetition" | "moveRule" | "insufficientMaterial";

export type Result =
  | { status: "ongoing" }
  | { status: "checkmate"; winner: Side }
  | { status: "draw"; reason: DrawReason };

export interface GameState {
  position: Position;
  /** Half-moves since the last capture or move by a `resetsMoveRule` piece. */
  quietPlies: number;
  /** Repetition key of every position reached, the start included. */
  history: string[];
  /** Whether repetition and the move rule end the game by themselves or must be claimed. */
  drawMode: DrawMode;
  /** The draw a player claimed; the game is over. */
  claimed?: "repetition" | "moveRule";
}

export type ClaimableDraw = "repetition" | "moveRule";

const other = (side: Side): Side => (side === "light" ? "dark" : "light");

/** Whether a royal piece of `side` (default: the side to move) is attacked. */
export function inCheck(ruleset: ResolvedRuleset, pos: Position, side: Side = pos.turn): boolean {
  const royal = Object.entries(pos.squares).filter(
    ([, p]) => p.side === side && ruleset.pieces.pieces[p.piece]?.royal,
  );
  if (!royal.length) return false;
  const attacked = attackedSquares(ruleset, pos, other(side));
  return royal.some(([sq]) => attacked.has(sq));
}

/** The position after `move`; the move is not checked. */
export function makeMove(pos: Position, move: Move): Position {
  const squares = { ...pos.squares };
  const { side, piece } = squares[move.from]!;
  delete squares[move.from];
  squares[move.to] = { side, piece: move.promotion ?? piece };
  return {
    squares,
    turn: other(pos.turn),
    ply: pos.ply + 1,
    unmoved: pos.unmoved.filter((sq) => sq !== move.from && sq !== move.to),
  };
}

/** Pseudo-legal moves that leave no royal piece of the mover attacked. */
export function legalMoves(ruleset: ResolvedRuleset, pos: Position): Move[] {
  return generateMoves(ruleset, pos).filter((m) => !inCheck(ruleset, makeMove(pos, m), pos.turn));
}

/** Same pieces on the same squares, same side to move, same legal moves (as in FIDE 9.2.2). */
function positionKey(ruleset: ResolvedRuleset, pos: Position): string {
  const pieces = Object.keys(pos.squares)
    .sort()
    .map((sq) => `${sq}:${pos.squares[sq]!.side}:${pos.squares[sq]!.piece}`);
  const moves = legalMoves(ruleset, pos).map(moveText).sort();
  return [pos.turn, pieces.join(","), moves.join(",")].join("|");
}

/** `drawMode` overrides the ruleset's draw mode for this game. */
export function newGame(
  ruleset: ResolvedRuleset,
  position: Position,
  options: { drawMode?: DrawMode } = {},
): GameState {
  return {
    position,
    quietPlies: 0,
    history: [positionKey(ruleset, position)],
    drawMode: options.drawMode ?? ruleset.draws.mode,
  };
}

/** Play a legal move. Throws if the game is over or the move is illegal. */
export function play(ruleset: ResolvedRuleset, game: GameState, move: Move): GameState {
  if (result(ruleset, game).status !== "ongoing") throw new Error("game is over");
  const text = moveText(move);
  const legal = legalMoves(ruleset, game.position).find((m) => moveText(m) === text);
  if (!legal) throw new Error(`illegal move ${text}`);
  const position = makeMove(game.position, legal);
  const resets = legal.captured || ruleset.pieces.pieces[legal.piece]?.resetsMoveRule;
  return {
    ...game,
    position,
    quietPlies: resets ? 0 : game.quietPlies + 1,
    history: [...game.history, positionKey(ruleset, position)],
  };
}

/** Non-royal pieces left match one of the ruleset's insufficient-material cases. */
function insufficientMaterial(ruleset: ResolvedRuleset, pos: Position): boolean {
  const rest = Object.entries(pos.squares).filter(
    ([, p]) => !ruleset.pieces.pieces[p.piece]?.royal,
  );
  const pieces = rest.map(([, p]) => p.piece).sort();
  const color = (sq: string) => {
    const { file, rank } = parseSquare(ruleset.board, sq);
    return (file + rank) % 2;
  };
  return ruleset.draws.insufficientMaterial.some((dead) =>
    "pieces" in dead
      ? pieces.join() === [...dead.pieces].sort().join()
      : rest.every(([, p]) => p.piece === dead.sameColor) &&
        new Set(rest.map(([sq]) => color(sq))).size <= 1,
  );
}

/** Draws a player may claim now: the position or move count has reached the ruleset's threshold. */
export function claimableDraws(ruleset: ResolvedRuleset, game: GameState): ClaimableDraw[] {
  if (game.drawMode !== "claim" || game.claimed) return [];
  if (!legalMoves(ruleset, game.position).length) return [];
  return thresholdDraws(ruleset, game);
}

function thresholdDraws(ruleset: ResolvedRuleset, game: GameState): ClaimableDraw[] {
  const { draws } = ruleset;
  const key = game.history.at(-1);
  const found: ClaimableDraw[] = [];
  if (game.history.filter((k) => k === key).length >= draws.repetitions) found.push("repetition");
  if (game.quietPlies >= 2 * draws.moveRule) found.push("moveRule");
  return found;
}

/** End the game as a draw. Throws unless `reason` is claimable now. */
export function claimDraw(
  ruleset: ResolvedRuleset,
  game: GameState,
  reason: ClaimableDraw,
): GameState {
  if (!claimableDraws(ruleset, game).includes(reason)) throw new Error(`cannot claim ${reason}`);
  return { ...game, claimed: reason };
}

/** Checkmate, stalemate, and dead material end the game; repetition and the move rule do too in `auto` mode, else once claimed. */
export function result(ruleset: ResolvedRuleset, game: GameState): Result {
  const pos = game.position;
  if (!legalMoves(ruleset, pos).length) {
    return inCheck(ruleset, pos)
      ? { status: "checkmate", winner: other(pos.turn) }
      : { status: "draw", reason: "stalemate" };
  }
  if (insufficientMaterial(ruleset, pos)) return { status: "draw", reason: "insufficientMaterial" };
  if (game.claimed) return { status: "draw", reason: game.claimed };
  if (game.drawMode === "auto") {
    const [reason] = thresholdDraws(ruleset, game);
    if (reason) return { status: "draw", reason };
  }
  return { status: "ongoing" };
}

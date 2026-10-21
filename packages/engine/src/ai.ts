/**
 * Computer opponent: a random legal mover and an alpha-beta search on this engine's own move
 * generation, so it plays any ruleset and setup. Piece values come from movement data, not names.
 */
import {
  inCheck,
  insufficientMaterial,
  legalMoves,
  makeMove,
  result,
  type GameState,
} from "./game";
import { attackedSquares, generateMoves, type Move, type Position } from "./moves";
import type { ResolvedRuleset, Side } from "./rules";
import { checkSetup, parseSquare, squareName, type Pieces } from "./setup";

/** A random source returning numbers in [0, 1). */
export type Random = () => number;

/** Deterministic random source (mulberry32). */
export function seededRandom(seed: number): Random {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A uniformly random legal move; undefined when the game is over. */
export function randomMove(
  ruleset: ResolvedRuleset,
  game: GameState,
  random: Random,
): Move | undefined {
  if (result(ruleset, game).status !== "ongoing") return undefined;
  const moves = legalMoves(ruleset, game.position);
  return moves[Math.floor(random() * moves.length)];
}

/** A random preset among those legal under the ruleset (written for light). */
export function chooseSetup(ruleset: ResolvedRuleset, presets: Pieces[], random: Random): Pieces {
  const legal = presets.filter((p) => !checkSetup(ruleset, "light", p).length);
  if (!legal.length) throw new Error("no preset is legal under this ruleset");
  return legal[Math.floor(random() * legal.length)]!;
}

interface Tables {
  /** Material per piece: its mean reach over every square of an empty board. Royal pieces: 0. */
  values: Record<string, number>;
  /** Per side, piece, and square: material plus centralization and promotion progress. */
  squares: Record<Side, Record<string, Record<string, number>>>;
}

const tableCache = new WeakMap<ResolvedRuleset, Tables>();
const SCALE = 100;
/** Weight of a square's reach above the piece's mean (provisional heuristic, not a rule). */
const CENTER = 0.1;
/** Reach units a promoting piece gains next to its promotion square (provisional heuristic). */
const PROMOTION = 3;

/** Squares a lone piece reaches from `sq` on an empty board, by moving or capturing. */
function reach(ruleset: ResolvedRuleset, side: Side, piece: string, sq: string): number {
  const pos: Position = { squares: { [sq]: { side, piece } }, turn: side, ply: 10, unmoved: [] };
  const to = new Set(generateMoves(ruleset, pos).map((m) => m.to));
  for (const s of attackedSquares(ruleset, pos, side)) to.add(s);
  return to.size;
}

function tables(ruleset: ResolvedRuleset): Tables {
  const hit = tableCache.get(ruleset);
  if (hit) return hit;
  const { board } = ruleset;
  const all: string[] = [];
  for (let file = 0; file < board.files; file++)
    for (let rank = 0; rank < board.ranks; rank++) all.push(squareName({ file, rank }));
  const values: Record<string, number> = {};
  const squares: Tables["squares"] = { light: {}, dark: {} };
  const maxDist = Math.max(board.files, board.ranks) - 1;
  for (const [piece, rules] of Object.entries(ruleset.pieces.pieces)) {
    for (const side of ["light", "dark"] as const) {
      const r = all.map((sq) => reach(ruleset, side, piece, sq));
      const mean = r.reduce((a, b) => a + b, 0) / r.length;
      if (side === "light") values[piece] = rules.royal ? 0 : Math.round(mean * SCALE);
      const promos = rules.promotesTo?.length ? board.sides[side].promotionSquares : [];
      squares[side][piece] = Object.fromEntries(
        all.map((sq, i) => {
          let score = (rules.royal ? 0 : mean) + CENTER * (r[i]! - mean);
          if (promos.length) {
            const at = parseSquare(board, sq);
            const dist = Math.min(
              ...promos.map((p) => {
                const q = parseSquare(board, p);
                return Math.max(Math.abs(q.file - at.file), Math.abs(q.rank - at.rank));
              }),
            );
            score += PROMOTION * (1 - dist / maxDist) ** 2;
          }
          return [sq, Math.round(score * SCALE)];
        }),
      );
    }
  }
  const t = { values, squares };
  tableCache.set(ruleset, t);
  return t;
}

/** Material value of each piece, from movement data. */
export function pieceValues(ruleset: ResolvedRuleset): Record<string, number> {
  return { ...tables(ruleset).values };
}

/** Static score for the side to move: positive is better for it. */
export function evaluate(ruleset: ResolvedRuleset, pos: Position): number {
  const { squares } = tables(ruleset);
  let score = 0;
  for (const [sq, p] of Object.entries(pos.squares)) {
    const s = squares[p.side][p.piece]?.[sq] ?? 0;
    score += p.side === pos.turn ? s : -s;
  }
  return score;
}

export interface SearchOptions {
  /** Plies to search before captures-only quiescence. */
  depth: number;
  /** Node budget; when spent, the deepest finished iteration's move is played. */
  maxNodes?: number;
  /** Breaks ties between equal moves; without it the first in generation order wins. */
  random?: Random;
}

const MATE = 1_000_000;
const QUIESCENCE_PLIES = 6;

/** Same pieces on the same squares, same side to move (positionKey's first two parts). */
function repetitionKey(pos: Position): string {
  const pieces = Object.keys(pos.squares)
    .sort()
    .map((sq) => `${sq}:${pos.squares[sq]!.side}:${pos.squares[sq]!.piece}`);
  return [pos.turn, pieces.join(",")].join("|");
}

class Search {
  nodes = 0;
  stopped = false;
  private seen: string[];

  constructor(
    private ruleset: ResolvedRuleset,
    private maxNodes: number,
    game: GameState,
  ) {
    this.seen = game.history.map((k) => k.split("|").slice(0, 2).join("|"));
  }

  private tick(): boolean {
    if (++this.nodes > this.maxNodes) this.stopped = true;
    return this.stopped;
  }

  /** Captures and promotions first, most valuable victim by least valuable attacker. */
  order(moves: Move[]): Move[] {
    const v = tables(this.ruleset).values;
    const score = (m: Move) =>
      (m.captured ? 10 * (v[m.captured] ?? 0) - (v[m.piece] ?? 0) + 1 : 0) +
      (m.promotion ? (v[m.promotion] ?? 0) : 0);
    return moves
      .map((m, i) => ({ m, i, s: score(m) }))
      .sort((a, b) => b.s - a.s || a.i - b.i)
      .map((x) => x.m);
  }

  resets(m: Move): boolean {
    return Boolean(m.captured || this.ruleset.pieces.pieces[m.piece]?.resetsMoveRule);
  }

  negamax(pos: Position, depth: number, alpha: number, beta: number, ply: number, quiet: number) {
    if (this.tick()) return 0;
    const { ruleset } = this;
    const key = repetitionKey(pos);
    if (this.seen.includes(key)) return 0;
    if (insufficientMaterial(ruleset, pos)) return 0;
    if (depth <= 0) return this.quiesce(pos, alpha, beta, 0);
    this.seen.push(key);
    let legal = 0;
    let best = -Infinity;
    for (const m of this.order(generateMoves(ruleset, pos))) {
      const next = makeMove(pos, m);
      if (inCheck(ruleset, next, pos.turn)) continue;
      legal++;
      const q = this.resets(m) ? 0 : quiet + 1;
      const score =
        q >= 2 * ruleset.draws.moveRule
          ? 0
          : -this.negamax(next, depth - 1, -beta, -alpha, ply + 1, q);
      if (this.stopped) break;
      if (score > best) best = score;
      if (score > alpha) alpha = score;
      if (alpha >= beta) break;
    }
    this.seen.pop();
    if (this.stopped) return 0;
    if (!legal) return inCheck(ruleset, pos) ? -MATE + ply : 0;
    return best;
  }

  private quiesce(pos: Position, alpha: number, beta: number, qply: number): number {
    if (this.tick()) return 0;
    const { ruleset } = this;
    const stand = evaluate(ruleset, pos);
    if (stand >= beta || qply >= QUIESCENCE_PLIES) return stand;
    if (stand > alpha) alpha = stand;
    const noisy = generateMoves(ruleset, pos).filter((m) => m.captured || m.promotion);
    for (const m of this.order(noisy)) {
      const next = makeMove(pos, m);
      if (inCheck(ruleset, next, pos.turn)) continue;
      const score = -this.quiesce(next, -beta, -alpha, qply + 1);
      if (this.stopped) return 0;
      if (score >= beta) return score;
      if (score > alpha) alpha = score;
    }
    return alpha;
  }
}

/**
 * The move an iterative-deepening alpha-beta search scores best; undefined when the game is over.
 * Repetitions in the search count as draws at their first recurrence.
 */
export function bestMove(
  ruleset: ResolvedRuleset,
  game: GameState,
  { depth, maxNodes = Infinity, random }: SearchOptions,
): Move | undefined {
  if (result(ruleset, game).status !== "ongoing") return undefined;
  const pos = game.position;
  const search = new Search(ruleset, maxNodes, game);
  let root = legalMoves(ruleset, pos);
  if (random) {
    for (let i = root.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [root[i], root[j]] = [root[j]!, root[i]!];
    }
  }
  root = search.order(root);
  let chosen = root[0]!;
  for (let d = 1; d <= depth; d++) {
    let best: Move | undefined;
    let alpha = -Infinity;
    for (const m of root) {
      const q = search.resets(m) ? 0 : game.quietPlies + 1;
      const score =
        q >= 2 * ruleset.draws.moveRule
          ? 0
          : -search.negamax(makeMove(pos, m), d - 1, -Infinity, -alpha, 1, q);
      if (search.stopped) break;
      if (score > alpha) {
        alpha = score;
        best = m;
      }
    }
    if (search.stopped || !best) break;
    chosen = best;
    root = [best, ...root.filter((m) => m !== best)];
    if (alpha > MATE - 1000) break;
  }
  return chosen;
}

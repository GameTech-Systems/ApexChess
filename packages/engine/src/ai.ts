/**
 * Computer opponent: a random legal mover and an alpha-beta search on this engine's own move
 * generation, so it plays any ruleset and setup. Piece values come from movement data, not names.
 */
import {
  inCheck,
  insufficientMaterial,
  legalMoves,
  makeMove,
  placementKey,
  positionKey,
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
  /** Plies to search before quiescence (captures and promotions, or every evasion in check). */
  depth: number;
  /**
   * Node budget; when spent, the deepest finished iteration's move is played, or the first move
   * in search order (captures and promotions first) if no iteration finished.
   */
  maxNodes?: number;
  /** Breaks ties between equal moves; without it the first in generation order wins. */
  random?: Random;
}

const MATE = 1_000_000;
const QUIESCENCE_PLIES = 6;

interface Safety {
  attacked: Set<string>;
  check: boolean;
}

interface PathEntry {
  placement: string;
  pos: Position;
  /** The game's repetition key, computed only when a later position has the same placement. */
  key?: string;
}

const changes = (m: Move) => Boolean(m.captured || m.promotion);

class Search {
  nodes = 0;
  stopped = false;
  /** The game's repetition keys, grouped by placement (the key's part before its last "|"). */
  private history = new Map<string, Set<string>>();
  /** Positions on the line being searched, root excluded (it is in the game's history). */
  private path: PathEntry[] = [];

  constructor(
    private ruleset: ResolvedRuleset,
    private maxNodes: number,
    game: GameState,
  ) {
    for (const key of game.history) {
      const placement = key.slice(0, key.lastIndexOf("|"));
      const keys = this.history.get(placement) ?? new Set<string>();
      keys.add(key);
      this.history.set(placement, keys);
    }
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

  /** Squares the opponent attacks, and whether a royal piece of the side to move is among them. */
  private safety(pos: Position): Safety {
    const { ruleset } = this;
    const attacked = attackedSquares(ruleset, pos, pos.turn === "light" ? "dark" : "light");
    const check = Object.entries(pos.squares).some(
      ([sq, p]) => p.side === pos.turn && ruleset.pieces.pieces[p.piece]?.royal && attacked.has(sq),
    );
    return { attacked, check };
  }

  /**
   * The position after `m`, or undefined when `m` leaves the mover's royal piece attacked.
   * Attacks run along rays that stop at the first occupied square, so when the mover is not in
   * check, a non-royal piece standing on an unattacked square cannot expose a royal piece.
   */
  private after(pos: Position, m: Move, safe: Safety): Position | undefined {
    const next = makeMove(pos, m);
    return this.surelySafe(m, safe) || !inCheck(this.ruleset, next, pos.turn) ? next : undefined;
  }

  private surelySafe(m: Move, { attacked, check }: Safety): boolean {
    return !check && !attacked.has(m.from) && !this.ruleset.pieces.pieces[m.piece]?.royal;
  }

  private anyLegal(pos: Position, moves: Move[], safe: Safety): boolean {
    return (
      moves.some((m) => this.surelySafe(m, safe)) || moves.some((m) => this.after(pos, m, safe))
    );
  }

  /**
   * Whether `pos` recurs, on the searched line or in the game, by the game's own repetition key
   * (so unmoved pieces and first-move rules count). The first recurrence counts as a draw.
   */
  private repeated(pos: Position, placement: string): boolean {
    const past = this.history.get(placement);
    const onPath = this.path.filter((e) => e.placement === placement);
    if (!past && !onPath.length) return false;
    const key = positionKey(this.ruleset, pos);
    if (past?.has(key)) return true;
    return onPath.some((e) => (e.key ??= positionKey(this.ruleset, e.pos)) === key);
  }

  /** An automatic draw other than stalemate: dead material, the move rule, or a repetition. */
  /** `material`: the last move captured or promoted, the only way dead material can arise. */
  private drawn(pos: Position, placement: string, quiet: number, material: boolean): boolean {
    const { ruleset } = this;
    return (
      (material && insufficientMaterial(ruleset, pos)) ||
      quiet >= 2 * ruleset.draws.moveRule ||
      this.repeated(pos, placement)
    );
  }

  /** Mate scores count plies from the root, so a nearer mate scores higher. */
  negamax(
    pos: Position,
    depth: number,
    alpha: number,
    beta: number,
    ply: number,
    quiet: number,
    material: boolean,
  ): number {
    if (depth <= 0) return this.quiesce(pos, alpha, beta, ply, quiet, material, 0);
    if (this.tick()) return 0;
    const { ruleset } = this;
    const placement = placementKey(pos);
    const safe = this.safety(pos);
    const moves = generateMoves(ruleset, pos);
    // As in `result`, checkmate and stalemate come before the other draws.
    if (this.drawn(pos, placement, quiet, material))
      return safe.check && !this.anyLegal(pos, moves, safe) ? -MATE + ply : 0;
    this.path.push({ placement, pos });
    let legal = 0;
    let best = -Infinity;
    for (const m of this.order(moves)) {
      const next = this.after(pos, m, safe);
      if (!next) continue;
      legal++;
      const q = this.resets(m) ? 0 : quiet + 1;
      const score = -this.negamax(next, depth - 1, -beta, -alpha, ply + 1, q, changes(m));
      if (this.stopped) break;
      if (score > best) best = score;
      if (score > alpha) alpha = score;
      if (alpha >= beta) break;
    }
    this.path.pop();
    if (this.stopped) return 0;
    if (!legal) return safe.check ? -MATE + ply : 0;
    return best;
  }

  /**
   * Captures and promotions, or every legal evasion while in check. Checkmate and stalemate are
   * scored before the static evaluation, then the other draws; standing pat is not allowed in check.
   */
  private quiesce(
    pos: Position,
    alpha: number,
    beta: number,
    ply: number,
    quiet: number,
    material: boolean,
    qply: number,
  ): number {
    if (this.tick()) return 0;
    const { ruleset } = this;
    const safe = this.safety(pos);
    const { check } = safe;
    const moves = generateMoves(ruleset, pos);
    if (!this.anyLegal(pos, moves, safe)) return check ? -MATE + ply : 0;
    const placement = placementKey(pos);
    if (this.drawn(pos, placement, quiet, material)) return 0;
    if (qply >= QUIESCENCE_PLIES) return evaluate(ruleset, pos);
    if (!check) {
      const stand = evaluate(ruleset, pos);
      if (stand >= beta) return stand;
      if (stand > alpha) alpha = stand;
    }
    this.path.push({ placement, pos });
    const searched = check ? moves : moves.filter((m) => m.captured || m.promotion);
    let cut: number | undefined;
    for (const m of this.order(searched)) {
      const next = this.after(pos, m, safe);
      if (!next) continue;
      const q = this.resets(m) ? 0 : quiet + 1;
      const score = -this.quiesce(next, -beta, -alpha, ply + 1, q, changes(m), qply + 1);
      if (this.stopped) break;
      if (score >= beta) {
        cut = score;
        break;
      }
      if (score > alpha) alpha = score;
    }
    this.path.pop();
    if (this.stopped) return 0;
    return cut ?? alpha;
  }
}

/**
 * The move an iterative-deepening alpha-beta search scores best; undefined when the game is over.
 * Repetitions in the search use the game's repetition key and count as draws at their first
 * recurrence.
 */
export function bestMove(
  ruleset: ResolvedRuleset,
  game: GameState,
  { depth, maxNodes = Infinity, random }: SearchOptions,
): Move | undefined {
  if (result(ruleset, game).status !== "ongoing") return undefined;
  const pos = game.position;
  let root = legalMoves(ruleset, pos);
  if (!root.length) return undefined;
  const search = new Search(ruleset, maxNodes, game);
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
      const next = makeMove(pos, m);
      const score = -search.negamax(next, d - 1, -Infinity, -alpha, 1, q, changes(m));
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

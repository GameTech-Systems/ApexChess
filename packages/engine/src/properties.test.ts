/**
 * Property tests: seeded random games under every parameter option, checking rules that must hold
 * in every position, not just the hand-picked fixtures.
 */
import { describe, expect, it } from "vitest";
import { chooseSetup, seededRandom } from "./ai";
import { catalog } from "./catalog";
import { inCheck, legalMoves, makeMove, newGame, play, result, type GameState } from "./game";
import { startPosition, type Move, type Position } from "./moves";
import { resolveRuleset, type ResolvedRuleset, type Side } from "./rules";
import { parseSquare, squareName } from "./setup";

const GAMES = 4;
const MAX_PLIES = 120;

function rulesetWith(parameters: Record<string, string> = {}): ResolvedRuleset {
  const c = structuredClone(catalog);
  Object.assign(c.rulesets[0]!.parameters, parameters);
  return resolveRuleset(c, "standard");
}

/** The default, then each option of each parameter on its own. */
const variants: [string, ResolvedRuleset][] = [
  ["defaults", rulesetWith()],
  ...catalog.parameters.flatMap((p) =>
    p.options
      .filter((o) => o.value !== p.default)
      .map((o): [string, ResolvedRuleset] => [
        `${p.id}=${o.value}`,
        rulesetWith({ [p.id]: o.value }),
      ]),
  ),
];

const other = (s: Side): Side => (s === "light" ? "dark" : "light");
const presets = catalog.setups.map((s) => s.pieces);

/** Visit every position of seeded random games from preset and random Player's Choice setups. */
function eachPosition(
  ruleset: ResolvedRuleset,
  seed: number,
  visit: (game: GameState, moves: Move[]) => void,
) {
  const random = seededRandom(seed);
  for (let g = 0; g < GAMES; g++) {
    const light = chooseSetup(ruleset, presets, random);
    const dark = chooseSetup(ruleset, presets, random);
    let game = newGame(ruleset, startPosition(ruleset, light, dark));
    for (let ply = 0; ply < MAX_PLIES; ply++) {
      const moves = legalMoves(ruleset, game.position);
      visit(game, moves);
      if (result(ruleset, game).status !== "ongoing") break;
      game = play(ruleset, game, moves[Math.floor(random() * moves.length)]!);
    }
  }
}

/** The position turned 180° with the sides swapped (h1 <-> a8 for the kings' corners). */
function mirror(ruleset: ResolvedRuleset, pos: Position): Position {
  const m = (name: string) => {
    const sq = parseSquare(ruleset.board, name);
    return squareName({
      file: ruleset.board.files - 1 - sq.file,
      rank: ruleset.board.ranks - 1 - sq.rank,
    });
  };
  const squares: Position["squares"] = {};
  for (const [sq, p] of Object.entries(pos.squares))
    squares[m(sq)] = { side: other(p.side), piece: p.piece };
  return { squares, turn: other(pos.turn), ply: pos.ply, unmoved: pos.unmoved.map(m) };
}

const count = (pos: Position) => Object.keys(pos.squares).length;
const key = (m: Move) => `${m.from}${m.to}${m.promotion ?? ""}`;

describe.each(variants)("engine properties (%s)", (_name, ruleset) => {
  it("a legal move never leaves the mover's royal piece attacked", () => {
    eachPosition(ruleset, 1, (game, moves) => {
      for (const m of moves)
        expect(inCheck(ruleset, makeMove(game.position, m), game.position.turn)).toBe(false);
    });
  });

  it("a move removes exactly the captured piece and never lands on its own side", () => {
    eachPosition(ruleset, 2, (game, moves) => {
      const pos = game.position;
      for (const m of moves) {
        const target = pos.squares[m.to];
        expect(pos.squares[m.from]).toEqual({ side: pos.turn, piece: m.piece });
        expect(target?.side).not.toBe(pos.turn);
        expect(m.captured).toBe(target?.piece);
        const after = makeMove(pos, m);
        expect(count(after)).toBe(count(pos) - (target ? 1 : 0));
        expect(after.squares[m.to]!.piece).toBe(m.promotion ?? m.piece);
        expect(after.turn).toBe(other(pos.turn));
      }
    });
  });

  it("making a move leaves the position it came from unchanged", () => {
    eachPosition(ruleset, 3, (game, moves) => {
      const before = structuredClone(game.position);
      for (const m of moves) makeMove(game.position, m);
      expect(game.position).toEqual(before);
    });
  });

  it("each side keeps exactly its royal pieces throughout", () => {
    const royal = Object.keys(ruleset.pieces.pieces).filter(
      (id) => ruleset.pieces.pieces[id]!.royal,
    );
    eachPosition(ruleset, 4, (game) => {
      for (const side of ["light", "dark"] as const) {
        const n = Object.values(game.position.squares).filter(
          (p) => p.side === side && royal.includes(p.piece),
        ).length;
        expect(n).toBe(royal.reduce((t, id) => t + (ruleset.army[id] ?? 0), 0));
      }
    });
  });

  it("no legal move means checkmate or stalemate, and the result says which", () => {
    eachPosition(ruleset, 5, (game, moves) => {
      if (moves.length) return;
      const r = result(ruleset, game);
      if (inCheck(ruleset, game.position))
        expect(r).toEqual({ status: "checkmate", winner: other(game.position.turn) });
      else expect(r).toEqual({ status: "draw", reason: "stalemate" });
    });
  });

  it("the rules are symmetric: a mirrored position has the mirrored legal moves", () => {
    eachPosition(ruleset, 6, (game, moves) => {
      const mirrored = mirror(ruleset, game.position);
      const expected = moves
        .map((m) => key({ ...m, from: mirror1(ruleset, m.from), to: mirror1(ruleset, m.to) }))
        .sort();
      expect(legalMoves(ruleset, mirrored).map(key).sort()).toEqual(expected);
      expect(inCheck(ruleset, mirrored)).toBe(inCheck(ruleset, game.position));
    });
  });
});

function mirror1(ruleset: ResolvedRuleset, name: string): string {
  const sq = parseSquare(ruleset.board, name);
  return squareName({
    file: ruleset.board.files - 1 - sq.file,
    rank: ruleset.board.ranks - 1 - sq.rank,
  });
}

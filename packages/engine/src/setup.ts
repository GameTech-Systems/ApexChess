/** Board geometry and Player's Choice setup checks, driven by board and ruleset data. */
import type { Board, ResolvedRuleset, Side } from "./rules";

export type Pieces = Record<string, string>;
export interface Square {
  file: number;
  rank: number;
}
export interface SetupError {
  code: "square" | "army" | "corner" | "region" | "beyond";
  message: string;
}

/** "h1" to { file: 7, rank: 0 }. Throws if the name is malformed or off the board. */
export function parseSquare(board: Board, name: string): Square {
  const m = /^([a-z])([1-9][0-9]?)$/.exec(name);
  const sq = m ? { file: m[1]!.charCodeAt(0) - 97, rank: Number(m[2]) - 1 } : null;
  if (!sq || sq.file >= board.files || sq.rank >= board.ranks)
    throw new Error(`square ${name} is not on the board`);
  return sq;
}

export function squareName(sq: Square): string {
  return String.fromCharCode(97 + sq.file) + (sq.rank + 1);
}

/** Chord index counted from the side's corner (chord 0): (square - corner) dot forward. */
export function chordOf(board: Board, side: Side, name: string): number {
  const s = board.sides[side];
  const sq = parseSquare(board, name);
  const corner = parseSquare(board, s.corner);
  return (sq.file - corner.file) * s.forward[0] + (sq.rank - corner.rank) * s.forward[1];
}

/** Map a setup written for light onto the side's squares using the board's mirror. */
export function placeSetup(board: Board, side: Side, pieces: Pieces): Pieces {
  const mirror = board.sides[side].mirror;
  const out: Pieces = {};
  for (const [name, piece] of Object.entries(pieces)) {
    const sq = parseSquare(board, name);
    const to =
      mirror === "rotate180"
        ? { file: board.files - 1 - sq.file, rank: board.ranks - 1 - sq.rank }
        : sq;
    out[squareName(to)] = piece;
  }
  return out;
}

/** Check a setup (written for light) for the side against the ruleset's setup constraints. Empty means legal. */
export function checkSetup(ruleset: ResolvedRuleset, side: Side, pieces: Pieces): SetupError[] {
  const { board, army } = ruleset;
  const { cornerPiece, frontChord, beyondFrontChord } = ruleset.setup.constraints;
  const errors: SetupError[] = [];

  const valid: Pieces = {};
  for (const [name, piece] of Object.entries(pieces)) {
    try {
      parseSquare(board, name);
      valid[name] = piece;
    } catch {
      errors.push({ code: "square", message: `${name} is not on the board` });
    }
  }

  const counts: Record<string, number> = {};
  for (const piece of Object.values(pieces)) counts[piece] = (counts[piece] ?? 0) + 1;
  for (const piece of new Set([...Object.keys(army), ...Object.keys(counts)])) {
    const want = army[piece] ?? 0;
    const have = counts[piece] ?? 0;
    if (want !== have)
      errors.push({ code: "army", message: `${piece}: ${have} placed, army has ${want}` });
  }

  const placed = placeSetup(board, side, valid);
  const corner = board.sides[side].corner;
  if (placed[corner] !== cornerPiece) {
    errors.push({ code: "corner", message: `${cornerPiece} must start on ${corner}` });
  }

  let beyond = 0;
  for (const name of Object.keys(placed)) {
    const chord = chordOf(board, side, name);
    if (chord <= frontChord) continue;
    if (beyondFrontChord.chords.includes(chord)) beyond++;
    else
      errors.push({
        code: "region",
        message: `${name} (chord ${chord}) is outside the setup area`,
      });
  }
  if (beyond > beyondFrontChord.maxPieces) {
    errors.push({
      code: "beyond",
      message: `${beyond} pieces beyond the front chord; at most ${beyondFrontChord.maxPieces}`,
    });
  }
  return errors;
}

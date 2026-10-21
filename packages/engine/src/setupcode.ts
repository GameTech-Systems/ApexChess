/** Setup codes and mirror families, driven by board, piece-set, and constraint data. */
import type { Board, ResolvedRuleset, Side } from "./rules";
import { chordOf, parseSquare, squareName, type Pieces } from "./setup";

/** Reflect a setup (written for light) across the side's corner-to-corner ray. Chords and the corner are unchanged. */
export function mirrorSetup(board: Board, side: Side, pieces: Pieces): Pieces {
  const { corner, forward } = board.sides[side];
  const c = parseSquare(board, corner);
  const dd = forward[0] * forward[0] + forward[1] * forward[1];
  const out: Pieces = {};
  for (const [name, piece] of Object.entries(pieces)) {
    const sq = parseSquare(board, name);
    const v = [sq.file - c.file, sq.rank - c.rank];
    const k = (2 * (v[0]! * forward[0] + v[1]! * forward[1])) / dd;
    const to = { file: c.file + k * forward[0] - v[0]!, rank: c.rank + k * forward[1] - v[1]! };
    out[squareName(to)] = piece;
  }
  return out;
}

/** Squares of the setup area, chord by chord from the corner, files ascending within a chord. */
function chordRows(ruleset: ResolvedRuleset): string[][] {
  const { board } = ruleset;
  const { beyondFrontChord, frontChord } = ruleset.setup.constraints;
  const last = Math.max(frontChord, ...beyondFrontChord.chords);
  const rows: string[][] = Array.from({ length: last + 1 }, () => []);
  for (let file = 0; file < board.files; file++)
    for (let rank = 0; rank < board.ranks; rank++) {
      const name = squareName({ file, rank });
      const chord = chordOf(board, "light", name);
      if (chord >= 0 && chord <= last) rows[chord]!.push(name);
    }
  return rows;
}

function letters(ruleset: ResolvedRuleset): Map<string, string> {
  const byLetter = new Map<string, string>();
  for (const [id, piece] of Object.entries(ruleset.pieces.pieces)) {
    if (byLetter.has(piece.letter)) throw new Error(`piece letter ${piece.letter} is used twice`);
    byLetter.set(piece.letter, id);
  }
  return byLetter;
}

/**
 * Short code for a setup written for light: chords from the king outward, joined by "/", one piece
 * letter per square, digits for runs of empty squares. Same code for either side. Throws for a
 * piece outside the setup area or without a letter.
 */
export function encodeSetup(ruleset: ResolvedRuleset, pieces: Pieces): string {
  const letterOf = new Map([...letters(ruleset)].map(([letter, id]) => [id, letter]));
  const rows = chordRows(ruleset);
  const inArea = new Set(rows.flat());
  for (const name of Object.keys(pieces))
    if (!inArea.has(name)) throw new Error(`${name} is outside the setup area`);
  return rows
    .map((row) => {
      let text = "";
      let gap = 0;
      for (const name of row) {
        const piece = pieces[name];
        if (piece === undefined) {
          gap++;
          continue;
        }
        const letter = letterOf.get(piece);
        if (!letter) throw new Error(`${piece} has no letter in this piece set`);
        text += (gap ? gap : "") + letter;
        gap = 0;
      }
      return text + (gap ? gap : "");
    })
    .join("/");
}

/** Read a setup code back into squares and pieces. Checks the shape only; `checkSetup` checks legality. */
export function decodeSetup(ruleset: ResolvedRuleset, code: string): Pieces {
  const idOf = letters(ruleset);
  const rows = chordRows(ruleset);
  const parts = code.trim().toUpperCase().split("/");
  if (parts.length !== rows.length)
    throw new Error(`setup code needs ${rows.length} chords, got ${parts.length}`);
  const pieces: Pieces = {};
  parts.forEach((part, i) => {
    const row = rows[i]!;
    let at = 0;
    for (const m of part.matchAll(/([1-9][0-9]*)|(.)/g)) {
      if (m[1]) at += Number(m[1]);
      else {
        const id = idOf.get(m[2]!);
        if (!id) throw new Error(`unknown piece letter ${m[2]} in setup code`);
        if (at < row.length) pieces[row[at]!] = id;
        at++;
      }
    }
    if (at !== row.length)
      throw new Error(`chord ${i} of the setup code covers ${at} squares, needs ${row.length}`);
  });
  return pieces;
}

/** One id for a setup and its mirror image: the smaller of their two codes. Group statistics by this. */
export function canonicalSetupId(ruleset: ResolvedRuleset, pieces: Pieces): string {
  const a = encodeSetup(ruleset, pieces);
  const b = encodeSetup(ruleset, mirrorSetup(ruleset.board, "light", pieces));
  return a <= b ? a : b;
}

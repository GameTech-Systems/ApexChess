import {
  checkSetup,
  chordOf,
  placeSetup,
  setupArea,
  type Pieces,
  type ResolvedRuleset,
  type SetupError,
  type Side,
} from "@apexchess/engine";

/**
 * The builder keeps setups written for light (as the engine and setup codes do) and only shows them
 * from the builder's seat. The corner piece and the beyond-the-front-chord limit come from the
 * ruleset's setup constraints.
 */

/** The corner square in the setup frame (light's), and the piece that must start there. */
function corner(ruleset: ResolvedRuleset): { square: string; piece: string } {
  return { square: ruleset.board.sides.light.corner, piece: ruleset.setup.constraints.cornerPiece };
}

/** Pieces of each kind still to place, from the ruleset's army. */
export function remaining(ruleset: ResolvedRuleset, pieces: Pieces): Record<string, number> {
  const left = { ...ruleset.army };
  for (const piece of Object.values(pieces)) if (piece in left) left[piece]!--;
  return left;
}

/** True for the square that holds the fixed corner piece. */
export function isLocked(ruleset: ResolvedRuleset, square: string): boolean {
  return square === corner(ruleset).square;
}

/** The setup with the corner piece on its corner and nowhere else; a piece it displaces goes back to the tray. */
export function withCornerPiece(ruleset: ResolvedRuleset, pieces: Pieces): Pieces {
  const { square, piece } = corner(ruleset);
  const next: Pieces = {};
  for (const [sq, p] of Object.entries(pieces)) if (p !== piece && sq !== square) next[sq] = p;
  next[square] = piece;
  return next;
}

/** A setup with only the corner piece placed. */
export function emptySetup(ruleset: ResolvedRuleset): Pieces {
  return withCornerPiece(ruleset, {});
}

/** Squares (setup frame) on the chords beyond the front chord. */
export function beyondSquares(ruleset: ResolvedRuleset): string[] {
  const { chords } = ruleset.setup.constraints.beyondFrontChord;
  return setupArea(ruleset).filter((sq) => chords.includes(chordOf(ruleset.board, "light", sq)));
}

function countBeyond(ruleset: ResolvedRuleset, pieces: Pieces): number {
  const beyond = new Set(beyondSquares(ruleset));
  return Object.keys(pieces).filter((sq) => beyond.has(sq)).length;
}

/** The move would put more pieces beyond the front chord than the constraints allow. */
export function wouldOverfillBeyond(
  ruleset: ResolvedRuleset,
  pieces: Pieces,
  square: string,
  from?: string,
): boolean {
  const next = { ...pieces };
  if (from !== undefined) delete next[from];
  next[square] = "_";
  const { maxPieces } = ruleset.setup.constraints.beyondFrontChord;
  const after = countBeyond(ruleset, next);
  return after > maxPieces && after > countBeyond(ruleset, pieces);
}

/**
 * Put `piece` on `square`, replacing what is there. With `from`, the piece moves from that square.
 * Returns the setup unchanged for a square outside the setup area, a piece the army has no more of,
 * the fixed corner, or a move that would overfill the chords beyond the front chord.
 */
export function placePiece(
  ruleset: ResolvedRuleset,
  pieces: Pieces,
  square: string,
  piece: string,
  from?: string,
): Pieces {
  if (!setupArea(ruleset).includes(square)) return pieces;
  if (isLocked(ruleset, square) || (from !== undefined && isLocked(ruleset, from))) return pieces;
  if (wouldOverfillBeyond(ruleset, pieces, square, from)) return pieces;
  const next = { ...pieces };
  if (from !== undefined) delete next[from];
  delete next[square];
  if ((remaining(ruleset, next)[piece] ?? 0) <= 0) return pieces;
  next[square] = piece;
  return next;
}

/** Take the piece off a square; the fixed corner stays. */
export function clearSquare(ruleset: ResolvedRuleset, pieces: Pieces, square: string): Pieces {
  if (isLocked(ruleset, square)) return pieces;
  const next = { ...pieces };
  delete next[square];
  return next;
}

/** The setup as it stands on the seat's own squares. */
export function seatSetup(ruleset: ResolvedRuleset, side: Side, pieces: Pieces): Pieces {
  return placeSetup(ruleset.board, side, pieces);
}

/**
 * The setup-frame square for a square seen from the seat. The board's mirrors (identity, rotate180)
 * are their own inverses, so mapping back is the same placement.
 */
export function fromSeat(ruleset: ResolvedRuleset, side: Side, square: string): string {
  return Object.keys(placeSetup(ruleset.board, side, { [square]: "" }))[0]!;
}

/** Legality of an arrangement for the seat; empty means it can be played. */
export function setupErrors(
  ruleset: ResolvedRuleset,
  pieces: Pieces,
  side: Side = "light",
): SetupError[] {
  return checkSetup(ruleset, side, pieces);
}

/** Swap the pieces on two squares; the fixed corner stays put. */
export function swapPieces(ruleset: ResolvedRuleset, pieces: Pieces, a: string, b: string): Pieces {
  const area = setupArea(ruleset);
  if (a === b || !area.includes(a) || !area.includes(b)) return pieces;
  if (isLocked(ruleset, a) || isLocked(ruleset, b)) return pieces;
  const next = { ...pieces };
  delete next[a];
  delete next[b];
  if (pieces[b] !== undefined) next[a] = pieces[b]!;
  if (pieces[a] !== undefined) next[b] = pieces[a]!;
  return next;
}

/** First and last square of a chord (seat frame), files ascending: "d1 to h5". */
export function chordSpan(ruleset: ResolvedRuleset, side: Side, chord: number): string {
  const squares = placeSetupSquares(ruleset, side).filter(
    (sq) => chordOf(ruleset.board, side, sq) === chord,
  );
  squares.sort();
  return squares.length ? `${squares[0]} to ${squares.at(-1)}` : "";
}

function placeSetupSquares(ruleset: ResolvedRuleset, side: Side): string[] {
  return Object.keys(
    placeSetup(ruleset.board, side, Object.fromEntries(setupArea(ruleset).map((sq) => [sq, ""]))),
  );
}

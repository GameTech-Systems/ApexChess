import {
  checkSetup,
  setupArea,
  type Pieces,
  type ResolvedRuleset,
  type SetupError,
} from "@apexchess/engine";

/** Pieces of each kind still to place, from the ruleset's army. */
export function remaining(ruleset: ResolvedRuleset, pieces: Pieces): Record<string, number> {
  const left = { ...ruleset.army };
  for (const piece of Object.values(pieces)) if (piece in left) left[piece]!--;
  return left;
}

/**
 * Put `piece` on `square`, replacing what is there. With `from`, the piece moves from that square.
 * Returns the setup unchanged for a square outside the setup area or a piece the army has no more of.
 */
export function placePiece(
  ruleset: ResolvedRuleset,
  pieces: Pieces,
  square: string,
  piece: string,
  from?: string,
): Pieces {
  if (!setupArea(ruleset).includes(square)) return pieces;
  const next = { ...pieces };
  if (from !== undefined) delete next[from];
  delete next[square];
  if ((remaining(ruleset, next)[piece] ?? 0) <= 0) return pieces;
  next[square] = piece;
  return next;
}

export function clearSquare(pieces: Pieces, square: string): Pieces {
  const next = { ...pieces };
  delete next[square];
  return next;
}

/** Legality of an arrangement for light; empty means it can be played. */
export function setupErrors(ruleset: ResolvedRuleset, pieces: Pieces): SetupError[] {
  return checkSetup(ruleset, "light", pieces);
}

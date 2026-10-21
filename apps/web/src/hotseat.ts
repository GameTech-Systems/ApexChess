import type { Move } from "@apexchess/engine";

/** Squares a piece on `from` can legally move to. */
export function targetsFrom(moves: Move[], from: string): Set<string> {
  return new Set(moves.filter((m) => m.from === from).map((m) => m.to));
}

/** Pieces to offer when a move from `from` to `to` can promote; empty when no choice is needed. */
export function promotionChoices(moves: Move[], from: string, to: string): string[] {
  const options = moves
    .filter((m) => m.from === from && m.to === to && m.promotion)
    .map((m) => m.promotion!);
  return options.length > 1 ? options : [];
}

/** Light squares are always white; the dark squares are black unless the player picks another color. */
export const darkSquareColors = {
  black: "#000000",
  brown: "#8b5a2b",
  green: "#3f7d4e",
  blue: "#3b6ea5",
  gray: "#6b6b6b",
} as const;
export type DarkSquareColor = keyof typeof darkSquareColors;
export const DEFAULT_DARK_SQUARE: DarkSquareColor = "black";

import type { Pieces, Side } from "@apexchess/engine";

export type Player = 0 | 1;

/** D15: player 1 (index 0) plays light in the first game, then players alternate sides each rematch. */
export function seatOf(player: Player, game: number): Side {
  return (player + game) % 2 === 0 ? "light" : "dark";
}

/** The setups for a game, as record keeps them: light's and dark's. */
export function setupsForGame(setups: readonly [Pieces, Pieces], game: number) {
  const lightIsFirst = seatOf(0, game) === "light";
  return lightIsFirst
    ? { light: setups[0], dark: setups[1] }
    : { light: setups[1], dark: setups[0] };
}

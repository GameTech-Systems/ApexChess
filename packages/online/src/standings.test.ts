import { describe, expect, it } from "vitest";
import type { Played } from "./pairing";
import { crosstable, standings } from "./standings";

// Four players, three rounds.
const rounds: Played[][] = [
  [
    { light: 0, dark: 1, score: [1, 0] },
    { light: 2, dark: 3, score: [0.5, 0.5] },
  ],
  [
    { light: 2, dark: 0, score: [0.5, 0.5] },
    { light: 1, dark: 3, score: [0, 1] },
  ],
  [
    { light: 0, dark: 3, score: [0, 1] },
    { light: 1, dark: 2, score: [1, 0] },
  ],
];

describe("standings", () => {
  it("ranks by score, then Sonneborn-Berger (round robin)", () => {
    expect(standings(4, rounds, "sonnebornBerger")).toEqual([
      { player: 3, score: 2.5, tiebreak: 3, rank: 1 },
      { player: 0, score: 1.5, tiebreak: 1.5, rank: 2 },
      { player: 2, score: 1, tiebreak: 2, rank: 3 },
      { player: 1, score: 1, tiebreak: 1, rank: 4 },
    ]);
  });

  it("ranks by score, then Buchholz (Swiss); full ties share a rank", () => {
    expect(standings(4, rounds, "buchholz")).toEqual([
      { player: 3, score: 2.5, tiebreak: 3.5, rank: 1 },
      { player: 0, score: 1.5, tiebreak: 4.5, rank: 2 },
      { player: 1, score: 1, tiebreak: 5, rank: 3 },
      { player: 2, score: 1, tiebreak: 5, rank: 3 },
    ]);
  });

  it("a bye scores its points and adds nothing to either tiebreak", () => {
    const withBye: Played[][] = [
      [
        { light: 0, dark: 1, score: [1, 0] },
        { light: 2, score: [1, 0] },
      ],
    ];
    for (const tb of ["sonnebornBerger", "buchholz"] as const)
      expect(standings(3, withBye, tb).find((s) => s.player === 2)).toEqual({
        player: 2,
        score: 1,
        tiebreak: 0,
        rank: 1,
      });
  });

  it("before any game, everyone shares rank 1", () => {
    expect(standings(4, [], "buchholz").map((s) => s.rank)).toEqual([1, 1, 1, 1]);
  });
});

describe("crosstable", () => {
  it("lists each player's games by round, with opponent, side, and points", () => {
    const table = crosstable(4, rounds);
    expect(table[0]).toEqual([
      { round: 0, opponent: 1, side: "light", score: 1 },
      { round: 1, opponent: 2, side: "dark", score: 0.5 },
      { round: 2, opponent: 3, side: "light", score: 0 },
    ]);
    expect(table[3]![2]).toEqual({ round: 2, opponent: 0, side: "dark", score: 1 });
  });

  it("shows a bye without an opponent", () => {
    const table = crosstable(3, [[{ light: 2, score: [1, 0] }]]);
    expect(table[2]).toEqual([{ round: 0, score: 1 }]);
    expect(table[0]).toEqual([]);
  });
});

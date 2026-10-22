import { describe, expect, it } from "vitest";
import { seededRandom } from "@apexchess/engine";
import {
  BYE_SCORE,
  roundRobinRound,
  roundRobinRounds,
  swissRound,
  swissRounds,
  type Pairing,
  type Played,
} from "./pairing";

const coin = (value: number) => () => value;
const key = (a: number, b: number) => (a < b ? `${a}-${b}` : `${b}-${a}`);
const players = (round: Pairing[]) =>
  round.flatMap((g) => (g.dark === undefined ? [g.light] : [g.light, g.dark]));

/** Every round of a round robin as games, with light winning each (enough to test pairings). */
function allRoundRobin(n: number, swap = false): Pairing[][] {
  return Array.from({ length: roundRobinRounds(n) }, (_, r) => roundRobinRound(n, r, swap));
}

/** Plays a whole Swiss event: the lower-numbered player wins each game. */
function playSwiss(n: number, rounds = swissRounds(n), heads = 0.1): Played[][] {
  const history: Played[][] = [];
  for (let r = 0; r < rounds; r++) {
    const round = swissRound(n, history, coin(heads));
    history.push(
      round.map((g) =>
        g.dark === undefined
          ? { ...g, score: [BYE_SCORE, 0] }
          : { ...g, score: g.light < g.dark ? [1, 0] : [0, 1] },
      ),
    );
  }
  return history;
}

function sideCounts(n: number, rounds: Pairing[][]): { light: number; dark: number }[] {
  const counts = Array.from({ length: n }, () => ({ light: 0, dark: 0 }));
  for (const round of rounds)
    for (const g of round) {
      if (g.dark === undefined) continue;
      counts[g.light]!.light++;
      counts[g.dark]!.dark++;
    }
  return counts;
}

describe("round robin (D20: up to 8 players)", () => {
  for (const n of [4, 5, 6, 7, 8]) {
    it(`${n} players: everyone meets everyone once, sides balanced`, () => {
      const rounds = allRoundRobin(n);
      expect(rounds).toHaveLength(n % 2 ? n : n - 1);
      const met = new Set<string>();
      for (const round of rounds) {
        // Each player appears once per round.
        expect(players(round).sort((a, b) => a - b)).toEqual(
          Array.from({ length: n }, (_, i) => i),
        );
        for (const g of round) if (g.dark !== undefined) met.add(key(g.light, g.dark));
      }
      expect(met.size).toBe((n * (n - 1)) / 2);
      for (const c of sideCounts(n, rounds))
        expect(Math.abs(c.light - c.dark)).toBeLessThanOrEqual(1);
    });
  }

  it("odd numbers: each player gets exactly one bye", () => {
    const byes = allRoundRobin(5).flatMap((r) =>
      r.filter((g) => g.dark === undefined).map((g) => g.light),
    );
    expect(byes.sort()).toEqual([0, 1, 2, 3, 4]);
  });

  it("the round-1 coin swaps every side, keeping the pairings", () => {
    const plain = allRoundRobin(6);
    const swapped = allRoundRobin(6, true);
    swapped.forEach((round, r) =>
      round.forEach((g, b) => {
        expect([g.light, g.dark]).toEqual([plain[r]![b]!.dark, plain[r]![b]!.light]);
      }),
    );
  });
});

describe("Swiss (D20: above 8 players)", () => {
  it("plays ceil(log2 n) + 1 rounds", () => {
    expect(swissRounds(9)).toBe(5);
    expect(swissRounds(16)).toBe(5);
    expect(swissRounds(17)).toBe(6);
    expect(swissRounds(32)).toBe(6);
  });

  for (const n of [9, 10, 13, 16, 21, 32]) {
    it(`${n} players: no repeat pairings, at most one bye each, sides within 2`, () => {
      const history = playSwiss(n);
      const met = new Set<string>();
      const byes = new Map<number, number>();
      for (const round of history) {
        expect(players(round).sort((a, b) => a - b)).toEqual(
          Array.from({ length: n }, (_, i) => i),
        );
        expect(round.filter((g) => g.dark === undefined)).toHaveLength(n % 2);
        for (const g of round) {
          if (g.dark === undefined) byes.set(g.light, (byes.get(g.light) ?? 0) + 1);
          else {
            expect(met.has(key(g.light, g.dark))).toBe(false);
            met.add(key(g.light, g.dark));
          }
        }
      }
      for (const count of byes.values()) expect(count).toBe(1);
      for (const c of sideCounts(n, history))
        expect(Math.abs(c.light - c.dark)).toBeLessThanOrEqual(2);
    });
  }

  it("round 1: the coin settles sides; later rounds pair by score", () => {
    const heads = swissRound(10, [], coin(0.1));
    const tails = swissRound(10, [], coin(0.9));
    heads.forEach((g, b) => expect([g.light, g.dark]).toEqual([tails[b]!.dark, tails[b]!.light]));
    const history = playSwiss(10, 1);
    // After round 1 the five winners are paired among themselves.
    const winners = new Set(history[0]!.map((g) => Math.min(g.light, g.dark!)));
    const next = swissRound(10, history, coin(0.1));
    const together = next.filter((g) => winners.has(g.light) && winners.has(g.dark!));
    expect(together).toHaveLength(2);
  });

  it("the bye goes to the lowest-ranked player who has not had one", () => {
    const history = playSwiss(9, 1);
    const first = history[0]!.find((g) => g.dark === undefined)!.light;
    const next = swissRound(9, history, coin(0.1));
    const bye = next.find((g) => g.dark === undefined)!.light;
    expect(bye).not.toBe(first);
    // Bye player has the lowest score among those without a bye.
    const score = (p: number) =>
      history[0]!.reduce(
        (s, g) => s + (g.light === p ? g.score[0] : g.dark === p ? g.score[1] : 0),
        0,
      );
    for (let p = 0; p < 9; p++) if (p !== first) expect(score(bye)).toBeLessThanOrEqual(score(p));
  });

  it("gives light to the player who has had dark more often", () => {
    const history: Played[][] = [
      [
        { light: 0, dark: 1, score: [1, 0] },
        { light: 2, dark: 3, score: [1, 0] },
        { light: 4, dark: 5, score: [1, 0] },
        { light: 6, dark: 7, score: [1, 0] },
        { light: 8, dark: 9, score: [1, 0] },
      ],
    ];
    // Even players had light in round 1: against an odd player, the odd one gets light.
    for (const g of swissRound(10, history, coin(0.1))) {
      const hadLight = (p: number) => p % 2 === 0;
      if (hadLight(g.light) !== hadLight(g.dark!)) expect(hadLight(g.light)).toBe(false);
    }
  });

  it("keeps its limits with random results (draws and upsets), 9 to 32 players", () => {
    for (let n = 9; n <= 32; n++)
      for (let seed = 1; seed <= 5; seed++) {
        const random = seededRandom(n * 100 + seed);
        const history: Played[][] = [];
        const met = new Set<string>();
        for (let r = 0; r < swissRounds(n); r++) {
          const round = swissRound(n, history, random);
          for (const g of round)
            if (g.dark !== undefined) {
              expect(met.has(key(g.light, g.dark))).toBe(false);
              met.add(key(g.light, g.dark));
            }
          history.push(
            round.map((g) => {
              if (g.dark === undefined) return { ...g, score: [BYE_SCORE, 0] };
              const x = random();
              return { ...g, score: x < 0.4 ? [1, 0] : x < 0.6 ? [0.5, 0.5] : [0, 1] };
            }),
          );
        }
        for (const c of sideCounts(n, history))
          expect(Math.abs(c.light - c.dark)).toBeLessThanOrEqual(2);
      }
  });

  it("is deterministic after round 1", () => {
    const history = playSwiss(12, 2);
    expect(swissRound(12, history, coin(0.1))).toEqual(swissRound(12, history, coin(0.9)));
  });
});

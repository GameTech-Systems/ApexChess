/** Random Player's Choice setups and setup features, driven by the ruleset's army and constraints. */
import {
  checkSetup,
  chordOf,
  parseSquare,
  setupArea,
  type Pieces,
  type Random,
  type ResolvedRuleset,
} from "@apexchess/engine";

function shuffle<T>(items: T[], random: Random): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/**
 * A random setup (written for light) the ruleset accepts: the corner piece on the corner, a random
 * feasible count of pieces beyond the front chord, and the rest of the army shuffled onto the squares.
 */
export function randomSetup(ruleset: ResolvedRuleset, random: Random): Pieces {
  const { board, army } = ruleset;
  const { cornerPiece, frontChord, beyondFrontChord } = ruleset.setup.constraints;
  const corner = board.sides.light.corner;
  const chord = (sq: string) => chordOf(board, "light", sq);
  const area = setupArea(ruleset);
  const home = area.filter((sq) => sq !== corner && chord(sq) <= frontChord);
  const beyond = area.filter((sq) => beyondFrontChord.chords.includes(chord(sq)));
  const rest: string[] = [];
  for (const [piece, n] of Object.entries(army))
    for (let i = piece === cornerPiece ? 1 : 0; i < n; i++) rest.push(piece);
  const counts: number[] = [];
  for (let k = 0; k <= Math.min(beyondFrontChord.maxPieces, beyond.length, rest.length); k++)
    if (rest.length - k <= home.length) counts.push(k);
  if (!counts.length || army[cornerPiece] === undefined)
    throw new Error("the setup constraints leave no legal arrangement");
  const k = counts[Math.floor(random() * counts.length)]!;
  const squares = [
    ...shuffle(home, random).slice(0, rest.length - k),
    ...shuffle(beyond, random).slice(0, k),
  ];
  const pieces: Pieces = { [corner]: cornerPiece };
  shuffle(rest, random).forEach((piece, i) => (pieces[squares[i]!] = piece));
  const errors = checkSetup(ruleset, "light", pieces);
  if (errors.length) throw new Error(`random setup is illegal: ${errors[0]!.message}`);
  return pieces;
}

/**
 * Features of a setup (written for light), unchanged by its mirror image: the pieces beyond the
 * front chord and on chord 1, each piece's count on the front chord, the chord of each single
 * piece, and whether a paired piece starts on one square color.
 */
export function setupFeatures(ruleset: ResolvedRuleset, pieces: Pieces): Record<string, string> {
  const { board, army } = ruleset;
  const { cornerPiece, frontChord } = ruleset.setup.constraints;
  const placed = Object.entries(pieces).map(([sq, piece]) => ({
    sq,
    piece,
    chord: chordOf(board, "light", sq),
  }));
  const names = (list: typeof placed) =>
    list
      .map((p) => p.piece)
      .sort()
      .join("+") || "none";
  const out: Record<string, string> = {
    beyond: names(placed.filter((p) => p.chord > frontChord)),
    chord1: names(placed.filter((p) => p.chord === 1)),
  };
  for (const piece of Object.keys(army).sort()) {
    if (piece === cornerPiece) continue;
    const mine = placed.filter((p) => p.piece === piece);
    out[`front.${piece}`] = String(mine.filter((p) => p.chord === frontChord).length);
    if (army[piece] === 1) out[`chord.${piece}`] = String(mine[0]?.chord);
    if (army[piece] === 2) {
      const colors = mine.map((p) => {
        const s = parseSquare(board, p.sq);
        return (s.file + s.rank) % 2;
      });
      out[`sameColor.${piece}`] = colors[0] === colors[1] ? "yes" : "no";
    }
  }
  return Object.fromEntries(Object.entries(out).sort(([a], [b]) => (a < b ? -1 : 1)));
}

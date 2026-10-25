import type { ReactNode } from "react";
import type { ResolvedRuleset } from "@apexchess/engine";
import { Board } from "./Board";
import { pieceDiagram } from "./pieceDiagrams";
import { chordSpan } from "./setupBuilder";

/** How each piece moves, for players new to chess. The squares in each diagram come from the engine. */
const PIECES: { id: string; name: string; text: (ctx: Ctx) => ReactNode }[] = [
  {
    id: "king",
    name: "King",
    text: () => (
      <>
        Moves one square in any direction: across, ahead, back, or on the slant. It may never move
        onto a square where it could be captured. Protect it: if your king is trapped, you lose.
      </>
    ),
  },
  {
    id: "queen",
    name: "Queen",
    text: () => (
      <>
        The strongest piece. Moves any number of squares in a straight line in any of the eight
        directions, like a rook and a bishop combined. It stops at the edge of the board or at the
        first piece in its way.
      </>
    ),
  },
  {
    id: "rook",
    name: "Rook",
    text: () => (
      <>
        Moves any number of squares along a file or a rank. On the turned board those lines run on
        the slant, from one lower edge to the opposite upper edge.
      </>
    ),
  },
  {
    id: "bishop",
    name: "Bishop",
    text: () => (
      <>
        Moves any number of squares along a chord (straight across) or a ray (straight ahead or
        back). It always stays on squares of the color it starts on.
      </>
    ),
  },
  {
    id: "knight",
    name: "Knight",
    text: () => (
      <>
        Jumps in an L: two squares along a file or rank, then one square to the side. It is the only
        piece that can jump over other pieces, and it lands on a square of the other color.
      </>
    ),
  },
  {
    id: "pawn",
    name: "Pawn",
    text: ({ lightPromotion, darkPromotion, twoStep }) => (
      <>
        Steps one square straight ahead along its ray, toward the opponent&apos;s corner
        {twoStep ? " (two squares on its first move, if the way is clear)" : ""}. It never captures
        that way. It captures one square forward and to the side, onto either square that shares an
        edge with it (the ringed pieces). Along a far edge it walks the edge toward the
        opponent&apos;s corner. Reaching the far corner ({lightPromotion} for light, {darkPromotion}{" "}
        for dark), it becomes a queen, rook, bishop, or knight of your choice.
      </>
    ),
  },
];

interface Ctx {
  lightPromotion: string;
  darkPromotion: string;
  twoStep: boolean;
}

/** The rules in brief; the full text is docs/RULES.md. */
export function Rules({ ruleset, onClose }: { ruleset: ResolvedRuleset; onClose: () => void }) {
  const { board, setup } = ruleset;
  const light = board.sides.light.corner;
  const dark = board.sides.dark.corner;
  const ctx: Ctx = {
    lightPromotion: board.sides.light.promotionSquares.join(", "),
    darkPromotion: board.sides.dark.promotionSquares.join(", "),
    twoStep: ruleset.parameters.pawnFirstMove === "two",
  };
  const max = setup.constraints.beyondFrontChord.maxPieces;
  const known = new Set(PIECES.map((p) => p.id));
  return (
    <section aria-label="Rules" className="rules">
      <h1>How to play Apex Chess</h1>
      <p className="lede">
        Apex Chess uses the ordinary chess pieces on an ordinary 8×8 board, turned 45°. If you have
        never played chess, start here: each side has 16 pieces, light moves first, and you take
        turns moving one piece at a time. You win by trapping the opposing king.
      </p>

      <h2>The board</h2>
      <p>
        Each king starts in its own light corner: light at {light}, dark at {dark}. A{" "}
        <strong>chord</strong> is a side-to-side line across the board; every chord is a single
        color. A <strong>ray</strong> is a line straight ahead and back. Files (a to h) and ranks (1
        to 8) run on the slant.
      </p>

      <h2>How the pieces move</h2>
      <p>
        In each diagram, a dot is a square the piece can move to, and a ring is a piece it can
        capture. A piece captures by moving onto the square of an opposing piece, which leaves the
        board. No piece but the knight can pass through another piece.
      </p>
      <ul className="piece-guide">
        {PIECES.filter((p) => p.id in ruleset.pieces.pieces).map((p) => {
          const d = pieceDiagram(ruleset, p.id);
          return (
            <li key={p.id}>
              <Board
                board={board}
                position={d.position}
                view="light"
                pieceSet={ruleset.pieces}
                targets={d.targets}
                coordinates={false}
                label={`${p.name} on ${d.square} and the squares it can reach`}
              />
              <div>
                <h3>{p.id === "pawn" ? "Pawns" : p.name}</h3>
                <p>{p.text(ctx)}</p>
              </div>
            </li>
          );
        })}
      </ul>
      {Object.keys(ruleset.pieces.pieces).some((id) => !known.has(id)) && (
        <p>This rule set has more pieces; see its rules text.</p>
      )}

      <h2>Check and checkmate</h2>
      <p>
        A king that is attacked is in <strong>check</strong>. Its player must end the check on the
        very next move: move the king, block the attack, or capture the attacker. You may never make
        a move that leaves your own king in check. If there is no way out, that is{" "}
        <strong>checkmate</strong> and the game is over: the checkmating player wins. You can also
        resign.
      </p>
      <p>
        The game is a draw by stalemate (the player to move is not in check but has no legal move),
        threefold repetition of a position, {ruleset.draws.moveRule} moves by each side without a
        capture or a pawn move, or when neither side has enough pieces left to checkmate.
      </p>

      <h2>What is different from regular chess</h2>
      <ul>
        <li>The board is turned so the kings start in opposite corners, facing each other.</li>
        <li>Rooks travel on the slant; bishops travel straight across and straight ahead.</li>
        <li>
          Pawns step straight ahead along their ray, capture forward to the side, and promote only
          on the far corner.
        </li>
        <li>There is no castling and no en passant.</li>
        <li>You can bring your own setup (below).</li>
      </ul>

      <h2>Setups: Player&apos;s Choice</h2>
      <p>
        Play the default setup, or build your own arrangement of the 16 pieces. Your king always
        starts in your corner. The front chord (
        {chordSpan(ruleset, "light", setup.constraints.frontChord)} for light) and the squares
        behind it are always full, and only {max === 1 ? "one piece" : `${max} pieces`} starts on
        the chord beyond it (
        {chordSpan(ruleset, "light", setup.constraints.beyondFrontChord.chords[0]!)} for light).
        That piece can be anything but the king. Online, you see your opponent&apos;s arrangement
        only when the game begins, and a coin flip decides who plays light.
      </p>

      <h2>The Elbow Room</h2>
      <p>
        Any existing chess set can be used for live play in this octant style: turn the board 45° so
        each king sits on its light corner, then play with personalized setups and rules. For live
        games played with special or altered rules, keep a printout or a written copy of the rule
        set at the table.
      </p>
      <button type="button" onClick={onClose}>
        Close
      </button>
    </section>
  );
}

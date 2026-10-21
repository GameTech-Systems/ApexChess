/** The rules in brief; the full text is docs/RULES.md. */
export function Rules({ onClose }: { onClose: () => void }) {
  return (
    <section aria-label="Rules" className="rules">
      <h2>How Apex Chess works</h2>
      <h3>The board</h3>
      <p>
        A standard 8×8 board turned 45°. Each king starts in its own light corner: light at h1, dark
        at a8. You always see your own king at the bottom. Files and ranks run on the slant. A chord
        is a side-to-side line; a ray is a forward-and-back line.
      </p>
      <h3>Setups</h3>
      <p>
        Build your own arrangement of the 16 pieces: the king in your corner, and only one piece
        beyond the front chord. Online, you see the opponent&apos;s arrangement only when the game
        begins.
      </p>
      <h3>Pieces</h3>
      <p>
        King, queen, rook, bishop, and knight move as in standard chess; there is no castling and no
        en passant. Rooks run along files and ranks, bishops along chords and rays.
      </p>
      <p>
        Pawns move one square straight ahead along their ray and never capture that way. They
        capture one square forward and to the side. They promote on the far corner (a8 for light, h1
        for dark).
      </p>
      <h3>Ending the game</h3>
      <p>
        Checkmate wins. Stalemate, threefold repetition, the fifty-move rule, and insufficient
        material are draws.
      </p>
      <h3>The Elbow Room</h3>
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

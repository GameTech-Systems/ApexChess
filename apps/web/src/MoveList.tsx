import { useEffect, useRef } from "react";
import type { Side } from "@apexchess/engine";

/** Moves paired into numbered turns; `first` is the side that moved first. */
export function movePairs(moves: readonly string[], first: Side = "light") {
  const plies: (string | undefined)[] = first === "light" ? [...moves] : [undefined, ...moves];
  const pairs: { n: number; plies: { text?: string; index?: number }[] }[] = [];
  for (let i = 0; i < plies.length; i += 2) {
    const at = (k: number) => {
      const text = plies[k];
      return text === undefined ? {} : { text, index: first === "light" ? k : k - 1 };
    };
    pairs.push({ n: i / 2 + 1, plies: [at(i), at(i + 1)] });
  }
  return pairs;
}

/**
 * The game's moves, one numbered turn per row (light's move, then dark's). With `onSelect`, each
 * move is a button and `current` (number of moves shown) marks the one on the board.
 */
export function MoveList({
  moves,
  first = "light",
  current,
  onSelect,
}: {
  moves: readonly string[];
  first?: Side;
  current?: number;
  onSelect?: (count: number) => void;
}) {
  const box = useRef<HTMLOListElement>(null);
  useEffect(() => {
    // Keep the latest move in view while playing.
    if (box.current && current === undefined) box.current.scrollTop = box.current.scrollHeight;
  }, [moves.length, current]);
  if (!moves.length) return <p className="moves-empty">No moves yet.</p>;
  return (
    <ol className="moves" aria-label="Moves" ref={box}>
      {movePairs(moves, first).map((pair) => (
        <li key={pair.n}>
          <span className="move-no">{pair.n}.</span>
          {pair.plies.map((ply, k) =>
            ply.text === undefined ? (
              <span key={k} className="move" />
            ) : onSelect ? (
              <button
                key={k}
                type="button"
                className="move"
                aria-current={ply.index! + 1 === current ? "step" : undefined}
                onClick={() => onSelect(ply.index! + 1)}
              >
                {ply.text}
              </button>
            ) : (
              <span key={k} className="move">
                {ply.text}
              </span>
            ),
          )}
        </li>
      ))}
    </ol>
  );
}

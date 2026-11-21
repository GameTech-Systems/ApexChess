import { useState } from "react";
import { startPosition, type ResolvedRuleset } from "@apexchess/engine";
import { Board } from "./Board";
import { DEFAULT_LEVEL, levels, type Level } from "./computer";
import { chordSpan } from "./setupBuilder";

export type Opponent = "hotseat" | "computer" | "online";
export type SetupChoice = "default" | "custom";
export type Panel = "rules" | "about" | "privacy" | "terms" | "stats" | "leaderboard" | "account";

const OPPONENTS: { id: Opponent; label: string; note: string }[] = [
  { id: "computer", label: "Play the computer", note: "Pick how strong it plays." },
  { id: "hotseat", label: "Two players, one screen", note: "Pass the device between moves." },
  { id: "online", label: "Play online", note: "Quick match, or a private room with a friend." },
];

const NEEDS_CONNECTION = "Needs a connection.";

/** The landing page: what Apex Chess is, how it differs from chess, and the way into a game. */
export function Home({
  ruleset,
  onStart,
  onOpen,
  onEvents,
  initialLevel = DEFAULT_LEVEL,
  online = true,
}: {
  ruleset: ResolvedRuleset;
  onStart: (opponent: Opponent, setup: SetupChoice, level: Level) => void;
  onOpen: (panel: Panel) => void;
  onEvents: () => void;
  initialLevel?: Level;
  /** False while the device has no connection: online-only choices are disabled (D24). */
  online?: boolean;
}) {
  const [chosen, setOpponent] = useState<Opponent>("computer");
  const opponent = !online && chosen === "online" ? "computer" : chosen;
  const [level, setLevel] = useState<Level>(initialLevel);
  const def = ruleset.setup.default.pieces;
  const { board } = ruleset;
  const light = board.sides.light.corner;
  const dark = board.sides.dark.corner;
  const max = ruleset.setup.constraints.beyondFrontChord.maxPieces;

  return (
    <div className="home">
      <section className="hero" aria-labelledby="headline">
        <div className="hero-text">
          <h1 id="headline" className="headline">
            <span>Chess</span>
            <span className="shift">Shifted</span>
          </h1>
          <p className="lede">
            The chess pieces you know, on a board turned 45°. Each king starts in its own corner,
            and you can bring your own setup.
          </p>
        </div>
        <div className="hero-board">
          <Board
            board={board}
            position={startPosition(ruleset, def, def)}
            view="light"
            pieceSet={ruleset.pieces}
            coordinates={false}
            label={`The default setup: light's king on ${light}, dark's on ${dark}`}
          />
        </div>
      </section>

      <section className="start" aria-labelledby="start-title">
        <h2 id="start-title">Start a game</h2>
        {!online && (
          <p className="offline-note" role="status">
            You are offline. The computer and two-player games work without a connection (offline
            play is ready on this device).
          </p>
        )}
        <fieldset className="opponents">
          <legend>Who are you playing?</legend>
          {OPPONENTS.map((o) => {
            const off = !online && o.id === "online";
            return (
              <label
                key={o.id}
                className={opponent === o.id ? "option chosen" : off ? "option off" : "option"}
              >
                <input
                  type="radio"
                  name="opponent"
                  value={o.id}
                  checked={opponent === o.id}
                  disabled={off}
                  onChange={() => setOpponent(o.id)}
                />
                <span>
                  <strong>{o.label}</strong>
                  <small>{off ? NEEDS_CONNECTION : o.note}</small>
                </span>
              </label>
            );
          })}
        </fieldset>
        {opponent === "computer" && (
          <label className="level">
            Computer strength{" "}
            <select value={level} onChange={(e) => setLevel(e.target.value as Level)}>
              {Object.entries(levels).map(([id, l]) => (
                <option key={id} value={id}>
                  {l.label}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="setup-choice">
          <button
            type="button"
            className="primary"
            onClick={() => onStart(opponent, "default", level)}
          >
            <strong>Play the default setup</strong>
            <small>Both armies start in the standard arrangement.</small>
          </button>
          <button
            type="button"
            className="secondary"
            onClick={() => onStart(opponent, "custom", level)}
          >
            <strong>Customize your setup</strong>
            <small>Arrange your own 16 pieces first.</small>
          </button>
        </div>
      </section>

      <section className="differences" aria-labelledby="diff-title">
        <h2 id="diff-title">How it differs from regular chess</h2>
        <ul>
          <li>
            The board stands on its corner. Light&apos;s king starts on {light} and dark&apos;s on{" "}
            {dark}, facing each other down the middle.
          </li>
          <li>
            Pawns step straight ahead toward the opposing corner, capture one square forward and to
            the side, may advance forward along the outer-edge squares, and promote only on the far
            corner.
          </li>
          <li>No castling and no en passant.</li>
          <li>
            Player&apos;s Choice: arrange your own army. Your king keeps its corner, and only{" "}
            {max === 1 ? "one piece" : `${max} pieces`} may start beyond your front chord (
            {chordSpan(ruleset, "light", ruleset.setup.constraints.frontChord)} for light).
          </li>
        </ul>
        <p>
          Bishops travel diagonally ahead (a ray) and across (a chord). Everything else is chess:
          rooks travel on the slants (ranks and files); kings, queens, and knights move the same as
          regular chess. Check, checkmate, stalemate, and promotion work the way you expect.{" "}
          <button type="button" className="link" onClick={() => onOpen("rules")}>
            Read the rules, with every piece&apos;s moves
          </button>
        </p>
      </section>

      <section className="more" aria-labelledby="more-title">
        <h2 id="more-title">More</h2>
        <ul>
          <li>
            <button type="button" className="link" disabled={!online} onClick={onEvents}>
              Tournaments
            </button>
            <span>{online ? "Run a private event for 4 to 32 players." : NEEDS_CONNECTION}</span>
          </li>
          <li>
            <button
              type="button"
              className="link"
              disabled={!online}
              onClick={() => onOpen("stats")}
            >
              Statistics
            </button>
            <span>{online ? "How each setup scores in online games." : NEEDS_CONNECTION}</span>
          </li>
          <li>
            <button
              type="button"
              className="link"
              disabled={!online}
              onClick={() => onOpen("leaderboard")}
            >
              Leaderboards
            </button>
            <span>{online ? "Ratings of players who chose to be listed." : NEEDS_CONNECTION}</span>
          </li>
          <li>
            <button
              type="button"
              className="link"
              disabled={!online}
              onClick={() => onOpen("account")}
            >
              Account
            </button>
            <span>
              {online ? "Optional. Sign in with a passkey for rated games." : NEEDS_CONNECTION}
            </span>
          </li>
        </ul>
      </section>
    </div>
  );
}

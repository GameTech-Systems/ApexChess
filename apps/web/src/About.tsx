import { FEEDBACK_QUESTION, FEEDBACK_URL } from "./beta";
import { CONTACT_EMAIL } from "./contact";

const SOURCE_URL = "https://github.com/GameTech-Systems/ApexChess";

export function About({
  onClose,
  onOpen,
}: {
  onClose?: () => void;
  onOpen?: (p: "rules") => void;
}) {
  return (
    <section aria-label="About" className="rules">
      <h1>About Apex Chess</h1>
      <p className="lede">
        Apex Chess is chess on a board turned 45°, so each king starts in its own light corner. The
        pieces are the standard ones; only the board is turned.
      </p>
      <h2>Ways to play</h2>
      <p>
        Play the default setup, or bring your own arrangement (Player&apos;s Choice). Online, you
        see your opponent&apos;s arrangement only when the game begins. Play the computer, a friend
        on one screen, or an opponent online.{" "}
        {onOpen ? (
          <button type="button" className="link" onClick={() => onOpen("rules")}>
            Read the rules
          </button>
        ) : (
          <a href="/rules/">Read the rules</a>
        )}
      </p>
      <h2>Play offline</h2>
      <p>
        After your first visit, Apex Chess works without a connection: the computer and two-player
        games run on your device, and the rules stay readable. Online play, tournaments, statistics,
        leaderboards, and accounts need a connection.
      </p>
      <h2>Rules and setups are data</h2>
      <p>
        New setups, presets, and rule sets can be added without rewriting the game. Every saved game
        records the ruleset and both setups it was played with.
      </p>
      <h2>Beta testing and feedback</h2>
      <p>
        Apex Chess is in beta. The rules are set at version 1.0; ratings, leaderboards and events
        are still being tested and may be reset. Your feedback shapes what comes next. The one
        question we most want answered: {FEEDBACK_QUESTION}
      </p>
      <p>
        Post in{" "}
        <a href={FEEDBACK_URL} rel="noopener noreferrer" target="_blank">
          GitHub Discussions
        </a>{" "}
        (playtest feedback, bugs, rule ideas), or write to{" "}
        <a href={`mailto:${CONTACT_EMAIL}?subject=Apex%20Chess%20beta%20feedback`}>
          {CONTACT_EMAIL}
        </a>{" "}
        if you would rather keep it private. Mention the rules version and, for a bug, your browser
        and device.
      </p>
      <h2>Source and contact</h2>
      <p>
        The code and rules are source-available under the PolyForm Shield License 1.0.0; they are
        not open source.{" "}
        <a href={SOURCE_URL} rel="noopener noreferrer" target="_blank">
          Source code
        </a>
        . Contact:{" "}
        <a href={`mailto:${CONTACT_EMAIL}`} target="_blank" rel="noopener noreferrer">
          {CONTACT_EMAIL}
        </a>
        .
      </p>
      {onClose && (
        <button type="button" onClick={onClose}>
          Close
        </button>
      )}
    </section>
  );
}

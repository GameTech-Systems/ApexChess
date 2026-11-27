import { useState } from "react";
import { importPgn, openPgnFile, type Shared } from "./share";

/**
 * Open a game from PGN text (D26): a file or pasted text. The game goes to the replay; nothing is
 * uploaded or saved, so it works offline. A bad file says why and changes nothing.
 */
export function PgnImport({ onOpen }: { onOpen: (shared: Shared) => void }) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string>();

  const finish = (got: ReturnType<typeof importPgn>) => {
    if (got.ok) {
      setError(undefined);
      onOpen(got.shared);
    } else setError(got.error);
  };

  return (
    <div className="pgn-import">
      <label>
        Choose a .pgn file{" "}
        <input
          type="file"
          accept=".pgn,application/x-chess-pgn,text/plain"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (file) finish(await openPgnFile(file));
            e.target.value = ""; // choosing the same file again must still fire
          }}
        />
      </label>
      <label>
        Or paste the game
        <textarea
          rows={5}
          value={text}
          spellCheck={false}
          onChange={(e) => setText(e.target.value)}
        />
      </label>
      <button type="button" className="secondary" onClick={() => finish(importPgn(text))}>
        Open game
      </button>
      {error && (
        <p className="pgn-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

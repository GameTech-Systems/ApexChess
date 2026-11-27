import {
  catalog,
  decodeSetup,
  encodeSetup,
  replay,
  toPgn,
  resolveRuleset,
  checkSetup,
  type GameRecord,
  type Pieces,
  type ResolvedRuleset,
} from "@apexchess/engine";

/**
 * Share links live in the URL fragment, which the browser never sends to a server. They hold a
 * ruleset id and version, setups, and moves only: no names, tokens, or room codes.
 */
export type Shared =
  | { kind: "setup"; pieces: Pieces }
  | { kind: "game"; record: GameRecord; ruleset: ResolvedRuleset };

const b64 = {
  to: (text: string) => btoa(text).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""),
  from: (text: string) => atob(text.replace(/-/g, "+").replace(/_/g, "/")),
};

export function setupLink(ruleset: ResolvedRuleset, pieces: Pieces): string {
  return "#setup=" + encodeURIComponent(encodeSetup(ruleset, pieces));
}

export function gameLink(ruleset: ResolvedRuleset, record: GameRecord): string {
  const { light, dark } = record.setups;
  const text = [
    record.ruleset.id,
    record.ruleset.version,
    encodeSetup(ruleset, light),
    encodeSetup(ruleset, dark),
    record.moves.join(" "),
  ].join("|");
  return "#game=" + b64.to(text);
}

/**
 * What a link fragment holds, or undefined if it is not valid and playable. Setups are read under
 * `ruleset` (the live one); a game under the version it records, so links made before a version
 * retired still open (D21).
 */
export function parseShare(ruleset: ResolvedRuleset, hash: string): Shared | undefined {
  try {
    if (hash.startsWith("#setup=")) {
      const pieces = decodeSetup(ruleset, decodeURIComponent(hash.slice(7)));
      return checkSetup(ruleset, "light", pieces).length ? undefined : { kind: "setup", pieces };
    }
    if (hash.startsWith("#game=")) {
      const parts = b64.from(hash.slice(6)).split("|");
      if (parts.length !== 5) return undefined;
      const [id, version, light, dark, moves] = parts as [string, string, string, string, string];
      const played = resolveRuleset(catalog, id, version); // throws on an unknown id or version
      const record: GameRecord = {
        ruleset: { id, version },
        setups: { light: decodeSetup(played, light), dark: decodeSetup(played, dark) },
        moves: moves ? moves.split(" ") : [],
      };
      replay(played, record); // throws on an illegal move
      return { kind: "game", record, ruleset: played };
    }
  } catch {
    return undefined;
  }
  return undefined;
}

/** Copy to the clipboard; false where the browser refuses. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** Save a finished or ongoing game as a .pgn file (tag names are provisional, D25). */
export function downloadPgn(ruleset: ResolvedRuleset, record: GameRecord): void {
  const url = URL.createObjectURL(
    new Blob([toPgn(ruleset, record)], { type: "application/x-chess-pgn" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = "apex-chess-game.pgn";
  link.click();
  // Revoking at once can cancel the download in some browsers (Safari).
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

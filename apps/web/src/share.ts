import {
  decodeSetup,
  encodeSetup,
  replay,
  checkSetup,
  type GameRecord,
  type Pieces,
  type ResolvedRuleset,
} from "@apexchess/engine";

/**
 * Share links live in the URL fragment, which the browser never sends to a server. They hold a
 * ruleset id and version, setups, and moves only: no names, tokens, or room codes.
 */
export type Shared = { kind: "setup"; pieces: Pieces } | { kind: "game"; record: GameRecord };

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

/** What a link fragment holds, or undefined if it is not a valid, playable share for `ruleset`. */
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
      const record: GameRecord = {
        ruleset: { id, version },
        setups: { light: decodeSetup(ruleset, light), dark: decodeSetup(ruleset, dark) },
        moves: moves ? moves.split(" ") : [],
      };
      replay(ruleset, record); // throws on a version mismatch or an illegal move
      return { kind: "game", record };
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

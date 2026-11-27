import {
  catalog,
  decodeSetup,
  encodeSetup,
  replay,
  toPgn,
  parsePgn,
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

/** Largest PGN text the import takes (D26, provisional). A long game is a few KB. */
export const PGN_MAX_CHARS = 200_000;

export type PgnImport = { ok: true; shared: Shared } | { ok: false; error: string };

const TOO_LARGE: PgnImport = { ok: false, error: "That file is too large to open." };

/**
 * Open a PGN from `toPgn` as a replayable game, read under the ruleset version it names, or say
 * in plain words why not. Nothing is saved or sent anywhere.
 */
export function importPgn(text: string): PgnImport {
  if (text.length > PGN_MAX_CHARS) return TOO_LARGE;
  if (!text.trim()) return { ok: false, error: "Choose a .pgn file or paste its text." };
  if (!/^\[Variant "Apex Chess"\]/m.test(text))
    return { ok: false, error: 'This is not an Apex Chess game (no [Variant "Apex Chess"] tag).' };
  let ruleset: ResolvedRuleset;
  try {
    const m = /^\[Ruleset "(\S+) (\S+)"\]/m.exec(text);
    if (!m) return { ok: false, error: "The game has no Ruleset tag." };
    ruleset = resolveRuleset(catalog, m[1]!, m[2]!);
  } catch {
    return { ok: false, error: "This game uses a ruleset version this app does not know." };
  }
  try {
    return { ok: true, shared: { kind: "game", record: parsePgn(ruleset, text), ruleset } };
  } catch (e) {
    const why = e instanceof Error ? e.message : "";
    return {
      ok: false,
      error: /^PGN has no \w+ tag|^bad /.test(why)
        ? `The game is incomplete: ${why.replace(/^PGN /, "")}.`
        : `The game could not be replayed (an illegal move or setup): ${why}`,
    };
  }
}

/** Import a chosen file. A file's bytes can be up to 4 per character, so size is checked first. */
export async function openPgnFile(file: {
  size: number;
  text(): Promise<string>;
}): Promise<PgnImport> {
  if (file.size > PGN_MAX_CHARS * 4) return TOO_LARGE;
  try {
    return importPgn(await file.text());
  } catch {
    return { ok: false, error: "The file could not be read." };
  }
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

/**
 * PGN text for a game record. Moves are written as the record keeps them (`e2-e4`, `e2xe4`,
 * `e7-e8=queen`), so import needs no board. Tag names are the provisional D25 default: `Variant`,
 * `Ruleset` ("<id> <version>"), `LightSetup` and `DarkSetup` (setup codes), plus `Result`.
 */
import { result } from "./game";
import { catalog } from "./catalog";
import type { GameRecord } from "./record";
import { replay } from "./record";
import { resolveRuleset, type ResolvedRuleset } from "./rules";
import { decodeSetup, encodeSetup } from "./setupcode";

export const PGN_VARIANT = "Apex Chess";

function resultToken(ruleset: ResolvedRuleset, record: GameRecord): string {
  const res = result(ruleset, replay(ruleset, record));
  if (res.status === "checkmate") return res.winner === "light" ? "1-0" : "0-1";
  return res.status === "draw" ? "1/2-1/2" : "*";
}

/** `ruleset` must be the one the record names. Throws if the record does not replay under it. */
export function toPgn(ruleset: ResolvedRuleset, record: GameRecord): string {
  const token = resultToken(ruleset, record);
  const tags: [string, string][] = [
    ["Variant", PGN_VARIANT],
    ["Ruleset", `${record.ruleset.id} ${record.ruleset.version}`],
    ["LightSetup", encodeSetup(ruleset, record.setups.light)],
    ["DarkSetup", encodeSetup(ruleset, record.setups.dark)],
    ["Result", token],
  ];
  const plies: string[] = [];
  const offset = ruleset.firstToMove === "dark" ? 1 : 0;
  record.moves.forEach((move, i) => {
    const k = i + offset;
    if (k % 2 === 0) plies.push(`${k / 2 + 1}. ${move}`);
    else plies.push(i === 0 ? `${(k - 1) / 2 + 1}... ${move}` : move);
  });
  const body = [...plies, token].join(" ");
  return tags.map(([name, value]) => `[${name} "${value}"]`).join("\n") + "\n\n" + body + "\n";
}

/**
 * The record a PGN from `toPgn` holds. `ruleset` reads the setup codes and must be the id and
 * version the tags name. Throws on a missing tag, a different ruleset version, or an illegal move.
 */
export function parsePgn(ruleset: ResolvedRuleset, text: string): GameRecord {
  const tags = new Map<string, string>();
  for (const m of text.matchAll(/^\[(\w+) "([^"]*)"\]\s*$/gm)) tags.set(m[1]!, m[2]!);
  const need = (name: string): string => {
    const value = tags.get(name);
    if (value === undefined) throw new Error(`PGN has no ${name} tag`);
    return value;
  };
  if (need("Variant") !== PGN_VARIANT) throw new Error("not an Apex Chess PGN");
  const [id, version] = need("Ruleset").split(" ");
  if (!id || !version) throw new Error("bad Ruleset tag");
  if (id !== ruleset.id || version !== ruleset.version)
    throw new Error(`PGN is for ${id}@${version}, not ${ruleset.id}@${ruleset.version} (version mismatch)`);
  const moves = text
    .replace(/^\[.*\]\s*$/gm, "")
    .split(/\s+/)
    .filter((t) => t && !/^\d+\.(\.\.)?$/.test(t) && !/^(1-0|0-1|1\/2-1\/2|\*)$/.test(t));
  const record: GameRecord = {
    ruleset: { id, version },
    setups: {
      light: decodeSetup(ruleset, need("LightSetup")),
      dark: decodeSetup(ruleset, need("DarkSetup")),
    },
    moves,
  };
  replay(ruleset, record); // throws on an illegal move
  return record;
}

/** Parse under the catalog's own copy of the ruleset the PGN names. */
export function parsePgnFromCatalog(text: string): { record: GameRecord; ruleset: ResolvedRuleset } {
  const m = /^\[Ruleset "(\S+) (\S+)"\]/m.exec(text);
  if (!m) throw new Error("PGN has no Ruleset tag");
  const ruleset = resolveRuleset(catalog, m[1]!, m[2]!);
  return { record: parsePgn(ruleset, text), ruleset };
}

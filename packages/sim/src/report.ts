/** Self-play reports: the 0003 aggregate of bot games, plus the cap count, written as Markdown. */
import type { Pieces, ResolvedRuleset, Result } from "@apexchess/engine";
import { aggregate, type Aggregate, type Row } from "./aggregate";
import type { Bot } from "./selfplay";
import type { Summary } from "./stats";

export type { Row } from "./aggregate";

export interface PlayedGame {
  index: number;
  light: number;
  dark: number;
  result: Result;
  plies: number;
  capped: boolean;
}

export interface ReportOptions {
  /** Rows with fewer games are not shown. */
  minGames: number;
  /** Family-wise two-sided level for "stands out". */
  alpha: number;
  /** Share of capped games above which the report warns. */
  capWarning: number;
}

export interface Report extends Aggregate {
  ruleset: { id: string; version: string };
  meta: { bot: Bot; seed: number; maxPlies: number };
  options: ReportOptions;
  games: number;
  capped: number;
}

/** Light's score: 1, ½, or 0. A capped game scores as a draw. */
function lightScore(r: Result): number {
  return r.status === "checkmate" ? (r.winner === "light" ? 1 : 0) : 0.5;
}

export function buildReport(
  ruleset: ResolvedRuleset,
  pool: Pieces[],
  games: PlayedGame[],
  meta: Report["meta"],
  options: ReportOptions,
): Report {
  const scored = games.map((g) => ({ light: g.light, dark: g.dark, score: lightScore(g.result) }));
  return {
    ruleset: { id: ruleset.id, version: ruleset.version },
    meta,
    options,
    games: games.length,
    capped: games.filter((g) => g.capped).length,
    ...aggregate(ruleset, pool, scored, options),
  };
}

const pct = (x: number) => `${(100 * x).toFixed(1)}%`;
const zText = (z: number) => (Number.isFinite(z) ? z.toFixed(2) : z > 0 ? "∞" : "−∞");
const cells = (s: Summary) =>
  [
    s.n,
    s.wins,
    s.draws,
    s.losses,
    pct(s.winPct),
    pct(s.score),
    `${pct(s.low)} to ${pct(s.high)}`,
    zText(s.z),
  ].join(" | ");
const HEAD = "Games | W | D | L | Win % | Score | 95% interval | z";
const RULE = "---|---|---|---|---|---|---|---";

export function toMarkdown(r: Report): string {
  const { bot, seed, maxPlies } = r.meta;
  const out = [
    "# Self-play report",
    "",
    `Ruleset \`${r.ruleset.id}@${r.ruleset.version}\` · bot depth ${bot.depth}, node cap ${bot.maxNodes} · seed ${seed} · ply cap ${maxPlies} · ${r.games} games, ${r.capped} capped (scored as draws).`,
    "",
    "Measures and thresholds: `docs/decisions/0003-self-play-measures.md`. Results describe this bot, not human play.",
  ];
  if (r.games && r.capped / r.games > r.options.capWarning)
    out.push(
      "",
      `**Warning: ${pct(r.capped / r.games).replace(".0%", "%")} of games hit the ply cap** (more than ${pct(r.options.capWarning).replace(".0%", "%")}); scores are cap-sensitive.`,
    );

  const verdict = (s: Summary) =>
    Math.abs(s.z) < 1.96 ? "no clear edge" : s.z > 0 ? "light ahead" : "dark ahead";
  out.push("", "## First move", "", "Light's view. An edge needs |z| ≥ 1.96.", "");
  out.push(`Sample | ${HEAD} | Verdict`, `---|${RULE}|---`);
  out.push(`All | ${cells(r.firstMove.all)} | ${verdict(r.firstMove.all)}`);
  if (r.firstMove.sameSetup)
    out.push(
      `Same setup both sides | ${cells(r.firstMove.sameSetup)} | ${verdict(r.firstMove.sameSetup)}`,
    );

  const bar = (rows: Row[], z: number) =>
    `Rows with at least ${r.options.minGames} games; a row stands out at |z| ≥ ${z.toFixed(2)} (Bonferroni, α = ${r.options.alpha}, ${rows.length} rows).`;
  out.push("", "## Setup families", "", "Games against other families, as light and as dark.", "");
  out.push(bar(r.families, r.zCritical.families), "");
  out.push(`Setup id | ${HEAD} | Stands out`, `---|${RULE}|---`);
  for (const f of r.families)
    out.push(
      `\`${f.label}\`${f.preset ? ` (${f.preset})` : ""} | ${cells(f.summary)} | ${f.standsOut ? "yes" : ""}`,
    );

  out.push(
    "",
    "## Setup features",
    "",
    "Games where the two sides differ on the feature, from the side that has the value. Families: pool setups with that value; with few, a row mostly measures those setups.",
    "",
  );
  out.push(bar(r.features, r.zCritical.features), "");
  out.push(`Feature | Value | Families | ${HEAD} | Stands out`, `---|---|---|${RULE}|---`);
  for (const f of r.features)
    out.push(
      `${f.feature} | ${f.value} | ${f.families} | ${cells(f.summary)} | ${f.standsOut ? "yes" : ""}`,
    );
  return out.join("\n") + "\n";
}

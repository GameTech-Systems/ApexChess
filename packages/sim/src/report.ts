/** Aggregate self-play games by first move, setup family, and setup feature, then write Markdown. */
import {
  canonicalSetupId,
  type Pieces,
  type ResolvedRuleset,
  type Result,
} from "@apexchess/engine";
import type { Bot } from "./selfplay";
import { setupFeatures } from "./setups";
import { addScore, emptyTally, summarize, zCritical, type Summary, type Tally } from "./stats";

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

export interface Row {
  label: string;
  feature?: string;
  value?: string;
  /** Pool families with this feature value: few means the row mostly measures those setups. */
  families?: number;
  /** Preset id, when the family is a preset's. */
  preset?: string;
  summary: Summary;
  standsOut: boolean;
}

export interface Report {
  ruleset: { id: string; version: string };
  meta: { bot: Bot; seed: number; maxPlies: number };
  options: ReportOptions;
  games: number;
  capped: number;
  firstMove: { all: Summary; sameSetup: Summary | null };
  families: Row[];
  features: Row[];
  zCritical: { families: number; features: number };
}

/** Light's score: 1, ½, or 0. A capped game scores as a draw. */
function lightScore(r: Result): number {
  return r.status === "checkmate" ? (r.winner === "light" ? 1 : 0) : 0.5;
}

function rows(
  tallies: Map<string, Tally & Omit<Row, "summary" | "standsOut">>,
  options: ReportOptions,
): { rows: Row[]; z: number } {
  const shown = [...tallies.values()].filter(
    (t) => t.wins + t.draws + t.losses >= options.minGames,
  );
  const z = zCritical(options.alpha, shown.length);
  return {
    rows: shown.map(({ wins, draws, losses, ...rest }) => {
      const summary = summarize({ wins, draws, losses });
      return { ...rest, summary, standsOut: Math.abs(summary.z) >= z };
    }),
    z,
  };
}

export function buildReport(
  ruleset: ResolvedRuleset,
  pool: Pieces[],
  games: PlayedGame[],
  meta: Report["meta"],
  options: ReportOptions,
): Report {
  const ids = pool.map((p) => canonicalSetupId(ruleset, p));
  const presetId = canonicalSetupId(ruleset, ruleset.setup.default.pieces);
  const features = pool.map((p) => setupFeatures(ruleset, p));
  const all = emptyTally();
  const same = emptyTally();
  const families = new Map<string, Tally & { label: string; preset?: string }>();
  for (const id of ids)
    families.set(id, {
      ...emptyTally(),
      label: id,
      ...(id === presetId ? { preset: ruleset.setup.default.id } : {}),
    });
  const byFeature = new Map<
    string,
    Tally & { label: string; feature: string; value: string; families: number }
  >();
  const featureTally = (feature: string, value: string) => {
    const key = `${feature}=${value}`;
    if (!byFeature.has(key)) {
      const families = new Set(ids.filter((_, i) => features[i]![feature] === value)).size;
      byFeature.set(key, { ...emptyTally(), label: key, feature, value, families });
    }
    return byFeature.get(key)!;
  };

  for (const g of games) {
    const s = lightScore(g.result);
    addScore(all, s);
    const [lid, did] = [ids[g.light]!, ids[g.dark]!];
    if (lid === did) {
      addScore(same, s);
      continue;
    }
    addScore(families.get(lid)!, s);
    addScore(families.get(did)!, 1 - s);
    const [lf, df] = [features[g.light]!, features[g.dark]!];
    for (const feature of Object.keys(lf)) {
      if (lf[feature] === df[feature]) continue;
      addScore(featureTally(feature, lf[feature]!), s);
      addScore(featureTally(feature, df[feature]!), 1 - s);
    }
  }

  const sorted = new Map(
    [...byFeature].sort(([, a], [, b]) =>
      a.feature === b.feature
        ? a.value.localeCompare(b.value, "en", { numeric: true })
        : a.feature < b.feature
          ? -1
          : 1,
    ),
  );
  const fam = rows(families, options);
  const feat = rows(sorted, options);
  return {
    ruleset: { id: ruleset.id, version: ruleset.version },
    meta,
    options,
    games: games.length,
    capped: games.filter((g) => g.capped).length,
    firstMove: {
      all: summarize(all),
      sameSetup: same.wins + same.draws + same.losses ? summarize(same) : null,
    },
    families: fam.rows,
    features: feat.rows,
    zCritical: { families: fam.z, features: feat.z },
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

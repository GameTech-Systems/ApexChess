/**
 * The 0003 measures over scored games: first move, setup families, and setup features
 * (docs/decisions/0003-self-play-measures.md). Shared by self-play reports and public statistics.
 */
import { canonicalSetupId, type Pieces, type ResolvedRuleset } from "@apexchess/engine";
import { setupFeatures } from "./setups";
import { addScore, emptyTally, summarize, zCritical, type Summary, type Tally } from "./stats";

/** One game between two setups of the pool, by index. */
export interface ScoredGame {
  light: number;
  dark: number;
  /** Light's score: 1, ½, or 0. */
  score: number;
}

export interface AggregateOptions {
  /** Rows with fewer games are not shown. */
  minGames: number;
  /** Family-wise two-sided level for "stands out". */
  alpha: number;
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

export interface Aggregate {
  firstMove: { all: Summary; sameSetup: Summary | null };
  families: Row[];
  features: Row[];
  zCritical: { families: number; features: number };
}

function rows(
  tallies: Map<string, Tally & Omit<Row, "summary" | "standsOut">>,
  options: AggregateOptions,
): { rows: Row[]; z: number } {
  const shown = [...tallies.values()].filter((t) => {
    const n = t.wins + t.draws + t.losses;
    return n > 0 && n >= options.minGames;
  });
  const z = zCritical(options.alpha, shown.length);
  return {
    rows: shown.map(({ wins, draws, losses, ...rest }) => {
      const summary = summarize({ wins, draws, losses });
      return { ...rest, summary, standsOut: Math.abs(summary.z) >= z };
    }),
    z,
  };
}

/** Aggregate games over a pool of setups (written for light). Throws when there are no games. */
export function aggregate(
  ruleset: ResolvedRuleset,
  pool: Pieces[],
  games: ScoredGame[],
  options: AggregateOptions,
): Aggregate {
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
    const s = g.score;
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
    firstMove: {
      all: summarize(all),
      sameSetup: same.wins + same.draws + same.losses ? summarize(same) : null,
    },
    families: fam.rows,
    features: feat.rows,
    zCritical: { families: fam.z, features: feat.z },
  };
}

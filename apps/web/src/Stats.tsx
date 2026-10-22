/** Public setup statistics (S19b): the daily snapshot from /api/stats, measures from decisions 0003. */
import { useEffect, useState } from "react";
import type {
  RulesetRef,
  StatsListing,
  StatsRow,
  StatsSnapshot,
  StatsSummary,
} from "@apexchess/online";

type FetchFn = (url: string) => Promise<Response>;
const browserFetch: FetchFn = (url) => fetch(url);

export async function loadJson<T>(fetchFn: FetchFn, url: string): Promise<T> {
  const fail = new Error("Could not load statistics. Try again later.");
  const res = await fetchFn(url).catch(() => {
    throw fail;
  });
  if (!res.ok) throw fail;
  return (await res.json()) as T;
}

/** The version this app plays when it has statistics, else the first listed. */
export function chooseListing(list: StatsListing[], current: RulesetRef): StatsListing | undefined {
  return (
    list.find((l) => l.ruleset.id === current.id && l.ruleset.version === current.version) ??
    list[0]
  );
}

const pct = (x: number) => `${(100 * x).toFixed(1)}%`;
const zText = (s: StatsSummary) =>
  s.z !== null ? s.z.toFixed(2) : s.score > 0.5 ? "∞" : s.score < 0.5 ? "−∞" : "0.00";
const HEAD = ["Games", "W", "D", "L", "Score", "95% interval", "z"];

function Cells({ s }: { s: StatsSummary }) {
  return (
    <>
      <td>{s.n}</td>
      <td>{s.wins}</td>
      <td>{s.draws}</td>
      <td>{s.losses}</td>
      <td>{pct(s.score)}</td>
      <td>
        {pct(s.low)} to {pct(s.high)}
      </td>
      <td>{zText(s)}</td>
    </>
  );
}

function Head({ first }: { first: string[] }) {
  return (
    <thead>
      <tr>
        {[...first, ...HEAD].map((h) => (
          <th key={h} scope="col">
            {h}
          </th>
        ))}
      </tr>
    </thead>
  );
}

function verdict(s: StatsSummary): string {
  const z = s.z ?? (s.score > 0.5 ? Infinity : s.score < 0.5 ? -Infinity : 0);
  return Math.abs(z) < 1.96 ? "no clear edge" : z > 0 ? "light ahead" : "dark ahead";
}

function Bar({ rows, z, alpha }: { rows: StatsRow[]; z: number; alpha: number }) {
  return (
    <p>
      A row stands out at |z| ≥ {z.toFixed(2)} (Bonferroni, α = {alpha}, {rows.length} rows).
    </p>
  );
}

export function StatsView({ snapshot: s }: { snapshot: StatsSnapshot }) {
  const { minGames, minPlies, alpha } = s.options;
  const first: [string, StatsSummary][] = [];
  if (s.firstMove.all) first.push(["All games", s.firstMove.all]);
  if (s.firstMove.sameSetup) first.push(["Same setup both sides", s.firstMove.sameSetup]);
  return (
    <>
      <p>
        Rules {s.ruleset.id} {s.ruleset.version} · {s.games} games through {s.asOf} (UTC). Online
        games that finished with at least {minPlies} plies count. A row needs at least {minGames}{" "}
        games. Score = (wins + draws / 2) / games. These numbers describe play on this site; none of
        them changes a rule. Measures: <code>docs/decisions/0003-self-play-measures.md</code>.
      </p>
      {!first.length && !s.families.length && !s.features.length ? (
        <p>Not enough games yet. Rows appear once they reach {minGames} games.</p>
      ) : (
        <>
          <h2>First move</h2>
          <p>Light's view. An edge needs |z| ≥ 1.96.</p>
          {first.length ? (
            <table>
              <Head first={["Sample"]} />
              <tbody>
                {first.map(([label, sum]) => (
                  <tr key={label}>
                    <td>{label}</td>
                    <Cells s={sum} />
                    <td>{verdict(sum)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p>Not enough games yet.</p>
          )}
          <h2>Setup families</h2>
          <p>
            A family is a setup and its mirror image. Games against other families, as light and as
            dark.
          </p>
          <Bar rows={s.families} z={s.zCritical.families} alpha={alpha} />
          <table>
            <Head first={["Setup id"]} />
            <tbody>
              {s.families.map((f) => (
                <tr key={f.label}>
                  <td>
                    <code>{f.label}</code>
                    {f.preset ? ` (${f.preset})` : ""}
                  </td>
                  <Cells s={f.summary} />
                  <td>{f.standsOut ? "stands out" : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <h2>Setup features</h2>
          <p>
            Games where the two sides differ on the feature, from the side that has the value.
            Families: how many families with that value played; with few, a row mostly measures
            those setups.
          </p>
          <Bar rows={s.features} z={s.zCritical.features} alpha={alpha} />
          <table>
            <Head first={["Feature", "Value", "Families"]} />
            <tbody>
              {s.features.map((f) => (
                <tr key={f.label}>
                  <td>{f.feature}</td>
                  <td>{f.value}</td>
                  <td>{f.families}</td>
                  <Cells s={f.summary} />
                  <td>{f.standsOut ? "stands out" : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </>
  );
}

export function Stats({
  onClose,
  current,
  fetchFn = browserFetch,
}: {
  onClose: () => void;
  current: RulesetRef;
  fetchFn?: FetchFn;
}) {
  const [list, setList] = useState<StatsListing[]>();
  const [chosen, setChosen] = useState<StatsListing>();
  const [snapshot, setSnapshot] = useState<StatsSnapshot>();
  const [error, setError] = useState<string>();
  useEffect(() => {
    loadJson<StatsListing[]>(fetchFn, "/api/stats").then(
      (l) => {
        setList(l);
        setChosen(chooseListing(l, current));
      },
      (e: Error) => setError(e.message),
    );
  }, [fetchFn, current]);
  useEffect(() => {
    if (!chosen) return;
    setSnapshot(undefined);
    setError(undefined);
    const { id, version } = chosen.ruleset;
    loadJson<StatsSnapshot>(fetchFn, `/api/stats/${id}/${version}`).then(setSnapshot, (e: Error) =>
      setError(e.message),
    );
  }, [fetchFn, chosen]);
  return (
    <section aria-label="Setup statistics" className="rules stats">
      <h1>Setup statistics</h1>
      {list && list.length > 1 && (
        <label>
          Rules{" "}
          <select
            value={list.indexOf(chosen!)}
            onChange={(e) => setChosen(list[Number(e.target.value)])}
          >
            {list.map((l, i) => (
              <option key={i} value={i}>
                {l.ruleset.id} {l.ruleset.version}
              </option>
            ))}
          </select>
        </label>
      )}
      {error ? (
        <p role="alert">{error}</p>
      ) : list && !list.length ? (
        <p>No statistics yet. They appear the day after enough online games have finished.</p>
      ) : snapshot ? (
        <StatsView snapshot={snapshot} />
      ) : (
        <p>Loading…</p>
      )}
      <button type="button" onClick={onClose}>
        Close
      </button>
    </section>
  );
}

/** Public leaderboards (S20d): one per ruleset id, opted-in players with a settled rating. */
import { useEffect, useState } from "react";
import type { Leaderboard as Board } from "@apexchess/online";
import { accountApi } from "./account";

export function LeaderboardView({ boards }: { boards: Board[] }) {
  return (
    <>
      <p>
        Players who chose to be listed, with a settled rating from rated quick-match games. To be
        listed, or to leave, use the Account page.
      </p>
      {boards.length ? (
        boards.map((b) => (
          <table key={b.ruleset}>
            <caption>{b.ruleset}</caption>
            <thead>
              <tr>
                {["#", "Handle", "Rating", "Rated games"].map((h) => (
                  <th key={h} scope="col">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {b.players.map((p, i) => (
                <tr key={p.handle}>
                  <td>{i + 1}</td>
                  <td>{p.handle}</td>
                  <td>{p.rating}</td>
                  <td>{p.games}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ))
      ) : (
        <p>No one is listed yet.</p>
      )}
    </>
  );
}

export function Leaderboard({ onClose }: { onClose: () => void }) {
  const [api] = useState(() => accountApi());
  const [boards, setBoards] = useState<Board[]>();
  const [error, setError] = useState<string>();
  useEffect(() => {
    api.leaderboards().then(setBoards, (e: Error) => setError(e.message));
  }, [api]);
  return (
    <section aria-label="Leaderboards" className="rules stats">
      <h1>Leaderboards</h1>
      {error ? (
        <p role="alert">{error}</p>
      ) : boards ? (
        <LeaderboardView boards={boards} />
      ) : (
        <p>Loading…</p>
      )}
      <button type="button" onClick={onClose}>
        Close
      </button>
    </section>
  );
}

/** Beta labelling (S24, D21/D22). Provisional defaults: launch as a beta on rules draft 0.1; rated play, leaderboards and events stay on, marked Beta. */
export const BETA_NOTE =
  "Beta: ratings, leaderboards and events are still being tested, and may be reset or change.";

export function rulesLabel(current: { id: string; version: string }): string {
  return `Rules: ${current.id} v${current.version} (draft)`;
}

export function BetaBadge({ current }: { current: { id: string; version: string } }) {
  return (
    <span className="beta-badge" title={BETA_NOTE}>
      <strong>Beta</strong> · {rulesLabel(current)}
    </span>
  );
}

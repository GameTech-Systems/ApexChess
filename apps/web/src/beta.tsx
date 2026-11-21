/** Beta labelling (S24, D21/D22). Rules are settled; the badge stays until enough players have confirmed everything works. */
export const BETA_NOTE =
  "Beta testing: ratings, leaderboards and events are still being tested, and may be reset or change.";

export function BetaBadge() {
  return (
    <span className="beta-badge" title={BETA_NOTE}>
      Beta Testing
    </span>
  );
}

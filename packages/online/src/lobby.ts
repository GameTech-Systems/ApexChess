/** Quick-match queue: first come, first paired, only with the same ruleset id and version. */

export interface Seeker {
  /** One per waiting connection. */
  ticket: string;
  /** "id@version"; players on different versions are never paired. */
  ruleset: string;
}

/** Add a seeker; pair them with the longest-waiting player on the same ruleset, if any. */
export function seek<T extends Seeker>(
  queue: readonly T[],
  seeker: T,
): { queue: T[]; pair?: [T, T] } {
  const rest = queue.filter((s) => s.ticket !== seeker.ticket);
  const at = rest.findIndex((s) => s.ruleset === seeker.ruleset);
  if (at < 0) return { queue: [...rest, seeker] };
  return { queue: rest.filter((_, i) => i !== at), pair: [rest[at]!, seeker] };
}

export function leave<T extends Seeker>(queue: readonly T[], ticket: string): T[] {
  return queue.filter((s) => s.ticket !== ticket);
}

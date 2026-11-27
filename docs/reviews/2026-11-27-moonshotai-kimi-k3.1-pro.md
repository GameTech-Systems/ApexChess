# Outside review: moonshotai/kimi-k3.1-pro

2026-11-27 · changes 9b664da..100cfb1

Unverified model output. Check each finding against the code before acting.

I need the full diff and relevant files to review the changes properly. The diff was truncated at `apps/web/src/Rules.tsx`, and I'm missing several key files referenced in the changes:

- `apps/web/src/Tutorial.tsx` (new file, referenced in HANDOFF.md)
- `apps/web/src/tutorial.ts` (exports `EASIEST_LEVEL`)
- `apps/web/src/tutorial.test.ts`
- `apps/web/src/share.ts` (for the `shared.ruleset` change in App.tsx)
- `packages/engine/src/rules.ts` (for `ResolvedRuleset.status` used by `checkLive`)
- `rules/rulesets/standard-0.1.0.json` and `standard-1.0.0.json` (to verify `status` fields)
- The rest of `apps/web/src/Rules.tsx`

Could you provide the complete diff (or the remaining portion) and these files? Without them I can only flag a few things tentatively:

**Tentative observations from what I can see:**

1. **`checkLive` only blocks `status === "retired"`** (`room.ts`). If the ruleset schema has other non-live statuses (e.g. `"draft"`), new rooms/events could be created on them. Should confirm against `rules.ts` and the ruleset JSON files.

2. **`playFromTutorial` in App.tsx** sets `setSetupChoice("default")` and `setLevel(EASIEST_LEVEL)` but I can't verify it resets custom setup state, pending promotion state, or online ticket handling correctly without seeing the surrounding component.

3. **Lesson content vs. rules**: The `mate-in-one` lesson (`b1-b7` with queen b1, knight d6, king a8) and the `give-check` answers need engine verification — HANDOFF.md says `tutorial.test.ts` checks these, but I can't confirm the test exists or is correct without seeing it. Also the `pick-setup` options use setup codes that should be validated against the setup-code rules in RULES.md §4 (e.g. option A `B/KR/RQB/PPPP/PPNPP/5N` has the king not on h1, which is correctly illegal; option C `K/RB/BQR/PPPP/PNPNP/2P3` needs chord-square counting to verify).

4. **HSTS header** (`_headers`): `max-age=31536000` without `includeSubDomains` is a safe choice; no issue. But note `_headers` only applies if the host (e.g. Cloudflare Pages) actually serves it — can't verify deployment from here.

5. **`Replay` now uses `shared.ruleset`** (App.tsx) — this looks like a correctness fix (replaying under the recorded ruleset rather than the live one), consistent with D21, but I need `share.ts` to confirm `shared.ruleset` is always resolved and can't be undefined for older share links.

Please paste the remaining diff and the files above and I'll give a ranked, concrete review.

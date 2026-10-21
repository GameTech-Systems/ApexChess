---
name: end-session
description: Finish an Apex Chess build session. Runs the checks, rewrites the handoff, logs the session, ships the pull request (open, wait for CI, merge), and recommends the next session's step, model, and effort. Use at the end of every session, or early when usage is running low.
---

Finish the current step.

1. **Verify.** Run every check that exists: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm validate:rules`. Before S5 there are no scripts; check that every changed JSON file parses and every changed shell script passes `bash -n`. Record pass and fail counts.
2. **Outcome.** `done` (all done-when checks pass), `partial` (some work is green, the step isn't finished), or `blocked` (say why).
3. **Handoff.** Rewrite `docs/HANDOFF.md` from `handoff-template.md` in this folder. Keep it under 30 lines; it loads at the start of every session. No private information.
4. **Log.** Append one row to `docs/sessions/LOG.md`. The note is 100 characters or fewer.
5. **Plan updates.** Set the step's status in `docs/BUILD-PLAN.md`. If public decisions changed through the owner's brief, update the "Decision defaults" table, and add a record in `docs/decisions/` for lasting choices. If a rule decision changed, update `docs/RULES.md` and remove its "provisional" mark.
6. **Commit** with a clear message, signed off (`git commit -s`), so the DCO check passes.
7. **Ship.** Write a PR body from `.github/PULL_REQUEST_TEMPLATE.md` (tick "Owner or Claude PR"; "What and why" in 1 to 3 lines, no file lists, the diff shows them) to a temp file, then run `scripts/claude/ship.sh "<step-id>: <title>" <body-file>`. It pushes the branch, opens or reuses the PR, waits for CI, and merges.
   - CI fails: fix it if the fix is small and in scope, commit, and run the script again. Otherwise stop and report.
   - Outcome `partial` or `blocked`: run `scripts/claude/ship.sh --no-merge ...` so the PR stays open, and name the branch to resume in the handoff.
   - Never merge red CI, never push to `main`, never force-push `main`.
8. **Choose the next session.** Name the next step, model, and effort, in this order:
   1. **Next step.** Outcome `done`: the next `todo` Code step in `docs/BUILD-PLAN.md` order (Owner steps are not Code sessions). Outcome `partial` or `blocked`: the same step, resuming the branch named in the handoff.
   2. **Start from the plan.** Use that step's model and effort in `docs/BUILD-PLAN.md` as the default.
   3. **Raise one level** (low → medium → high), or switch Sonnet → Opus, if this session needed repeated attempts on design or correctness, ended `partial` or `blocked`, or left a test failing or skipped. Never above Opus 5.5 · high: `xhigh` and `max` are the owner's call. Never Fable.
   4. **Lower** when the next step is mechanical: Haiku 5.5 · low for docs-only or config follow-ups, or Opus → Sonnet when the design is settled and the next step only implements it.
   5. **Owner step blocks it?** If an Owner step must finish before that Code step, say so in the `Why:` line and list it under `questions` in the `ledger-sync` block.
9. **Close** with exactly this as the end of your reply (the `Set:` line is the two commands the owner types before the first message; add the last line only when the next model is Opus):

   Next session → S<n> · <model> · effort <level>
   Set: /model <sonnet|opus|haiku> · /effort <low|medium|high>
   Why: <one line, 15 words or fewer>
   Start with: /start-session S<n>
   Tip: start in a fresh usage window.

   Then a fenced code block tagged `ledger-sync` holding one JSON object in the format at the end of `docs/BUILD-PLAN.md`. It always starts with `"project":"apex"`, so the owner's shared ledger files it under Apex Chess. Include issue ids from the owner's brief under `resolved` when this step fixed them, new problems under `newIssues`, and anything the owner must choose under `questions` (with a default option index so work can continue). Keep every string to one short sentence, and make `next` match the lines above.

Keep the whole closing reply under 10 lines before the `ledger-sync` block: the outcome in one line, any problems the owner must resolve, then the next-session lines.

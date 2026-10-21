# Development workflow (Claude Code)

Apex Chess is built with Claude Code on a Pro plan, mostly in cloud sessions at claude.ai/code, using the same session system as the owner's other game repository. The step list is [BUILD-PLAN.md](BUILD-PLAN.md).

## Three ways changes reach `main`

1. **Claude Code sessions** (most work). Each step ends with `/end-session`, which runs `scripts/claude/ship.sh`: push the branch, open a pull request, wait for the `ci` check, merge.
2. **Claude in chat** (rules text, plans, small fixes). Claude opens a pull request through the GitHub connector and merges it after CI.
3. **Zip upload** (the owner, from a browser). Upload a `.zip` at the top level of the repository. `.github/workflows/unpack-zip.yml` unpacks it at the repository root, removes the zip, and commits. Before the `main` ruleset exists it commits straight to `main`; after that, GitHub's upload page puts the zip on a new branch, and the workflow runs CI and turns on auto-merge for that branch's pull request.

Zip rules: paths inside the zip are paths from the repository root (zip the files, not a folder that contains them). A zip adds or replaces files; it can't delete them. The workflow refuses absolute paths, `..`, `.git/`, and anything under `.github/workflows/`, because GitHub does not let a workflow's own token change workflow files. Workflow changes ship through routes 1 or 2, or are pasted by hand.

## GitHub setup checklist (owner, step S2)

Do these in order. Settings are under the repository's **Settings** tab.

1. **General → Pull Requests:** allow rebase merging; turn on **Allow auto-merge** and **Automatically delete head branches**.
2. **General → Commits:** turn on **Require contributors to sign off on web-based commits**, so uploads made in the browser pass the DCO check.
3. **Actions → General → Workflow permissions:** choose **Read and write permissions** and tick **Allow GitHub Actions to create and approve pull requests**. Save. If either option is greyed out, turn it on first in the organization's Settings → Actions → General, then come back.
4. **Advanced Security** (or Code security): turn on secret scanning with push protection, Dependabot alerts, and private vulnerability reporting.
5. **Apps:** add this repository to the **Claude** GitHub App installation for the organization (needed for Claude Code cloud sessions to push), and install the **DCO** app on it.
6. **Workflow files, by hand:** on the repository's Code tab choose Add file → Create new file. Name it `.github/workflows/unpack-zip.yml`, paste the file, and commit directly to `main`. Repeat for `.github/workflows/ci.yml`.
7. **Foundation zip:** Add file → Upload files, drop the foundation zip at the top level, commit directly to `main`. Watch the Actions tab: "Unpack zip" should finish green, and the files appear on `main`.
8. **Ruleset:** open `.github/rulesets/main.json` and download it (Download raw file). Then Settings → Rules → Rulesets → New ruleset → Import a ruleset, choose the file, and create it. From now on `main` needs a pull request and the `ci` check, and force-pushes and deletion are blocked.
9. **Test the zip route once:** upload a small zip (for example one file, `docs/zip-test.md`). GitHub asks for a new branch; accept it and create the pull request. The workflow unpacks it, runs CI, and auto-merges. Delete the test file afterwards with a normal pull request, or leave it.
10. **Discussions** (optional now): turn them on with categories whose slugs are `rule-proposals` and `playtest-feedback`.
11. **Claude Code on the web:** at claude.ai/code, add this repository to an environment with **Trusted** network access. Two-factor authentication stays on for every account.

## A session, start to finish

1. Open a **new** session on this repo. Cloud sessions have no `/clear`; one session per step keeps context small.
2. Set the model and effort the step recommends, before the first message: `/model sonnet` or `/model opus`, then `/effort medium` (or `low`, `high`, `xhigh`). Sonnet 5.5 is the project default.
3. Send `/start-session S<n>`, optionally followed by the brief from the owner's ledger.
4. Claude plans, writes failing tests, implements, and commits after each green task.
5. `/end-session` runs the checks, rewrites the handoff, logs the session, and ships the PR. It ends with the next session's step, model, and effort, and a `ledger-sync` block (with `"project":"apex"`) for the owner's ledger.

## Merging policy

Claude opens and merges its own pull requests after CI passes. The owner does not approve them, because PRs opened from a cloud session carry the owner's GitHub account and GitHub doesn't let a PR's author approve it. The `main` ruleset requires a pull request and the `ci` check, allows only rebase merges, and blocks force-pushes and deletion. Owner review through CODEOWNERS is switched on only when outside pull requests open. The DCO check runs on every PR, so every commit is signed off (`git commit -s`).

## Habits that stretch the plan

1. One step per session, one PR per step.
2. A written plan before any multi-file change; Claude goes ahead without waiting for approval.
3. Failing test first; targeted test runs while working, the full suite at the end.
4. Keep CLAUDE.md short. The handoff carries the moving state.
5. Set model and effort at the start; switching mid-session re-reads the whole conversation without the cache.
6. Expect two limits, a rolling 5-hour window and a weekly cap, shared with claude.ai chat. Use chat for design discussion and the ledger, and Claude Code for implementation. Start Opus steps at the beginning of a fresh window.

## Repo hygiene

Never put secrets, personal information, or unreleased art in this repository. `.claude/settings.json` blocks reading `.env` and private paths, and blocks force-pushes and direct pushes to `main`.

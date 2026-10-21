# Apex Chess (ApexChess repo): project memory for Claude Code

@docs/HANDOFF.md

## What this is
Apex Chess is a chess variant: the standard pieces on a standard 8×8 board turned 45°, so each king starts in its own light corner (h1 and a8). Players can bring their own starting arrangement (Player's Choice, `docs/RULES.md` section 4), and online opponents see each other's arrangement only when the game begins. Rules and setups are data, so new setups, presets, and rule sets are easy to add. Gameplay lives at apexchess.icu. This repo is public and source-available (PolyForm Shield 1.0.0), never "open source".

## Session protocol
1. **Start** with `/start-session S<n>`. One build-plan step per session, one pull request per step. The step list is `docs/BUILD-PLAN.md`; read only your step's section.
2. **Model and effort** come from the step (or the owner's pasted ledger brief). If the session runs on something else, give the owner the exact commands (`/model sonnet`, `/effort medium`) at the top of your first reply. Don't switch models mid-session yourself: it drops the prompt cache.
3. **Plan** before any change that touches several files: write the plan in your reply and go ahead without waiting for approval. Don't use plan mode. **Write the failing test first.** Commit after every green task.
4. **End** automatically with `/end-session` when the step is done, or early if usage is running low (unfinished work stays on its branch). The last message always ends with the next session's step, model, and effort, in the exact format `/end-session` gives.

## Token efficiency
Short output is the default: every reply, note, and file is paid for again in later sessions.
- **Replies:** facts and decisions only. No task recap, no narrating tool calls, no pasting files or diffs (cite `path:line`). Mid-session updates 1 to 3 lines; final report under 10 lines plus the closing block.
- **Written notes:** handoff under 30 lines, a log note of 100 characters or fewer, PR "What and why" in 1 to 3 lines, one-line commit subjects, one short sentence per `ledger-sync` string. Don't create summary or notes files the step doesn't ask for.
- **Reading:** grep or glob first, then read only the line range you need. Don't re-read a file you just wrote. Skip lockfiles, build output, and `node_modules`.
- **Running:** targeted tests while working, the full suite once at the end. Cap noisy output (`| tail -n 40`, or the dot reporter) and report only failing test names and first error lines.
- **Batching:** make independent tool calls in the same turn. Don't start subagents or web searches unless the step calls for them.
- **Spend where it pays:** failing test first; a few-line plan before multi-file work. If the same fix fails twice, stop: record what you tried in the handoff, set the outcome `partial`, and recommend more effort (or Opus) for the next session instead of looping.
- **Cache:** one step per session; don't change model or effort mid-session. If a session gets long or drifts, run `/end-session` early and continue in a fresh one.

## Decisions and defaults
- Owner decisions are made in a private ledger. Public ones reach you through the owner's brief, the "Decision defaults" table in `docs/BUILD-PLAN.md`, and `docs/decisions/`.
- **Defaults, not stalls.** When a step needs an open decision, apply its default, mark it provisional (in the data's `source` or `notes`, or a code comment), list it in the handoff, and keep going.
- **Never invent rules.** Choose only among options already listed in `rules/` or in a decision. New pieces, movement, setup rules, parameters, or options come from the owner. If none fits, record the question in the handoff and work on the rest of the step.

## Pull requests and merging
- Claude opens and merges its own PRs; the owner does not approve them. Use `scripts/claude/ship.sh` (it uses the GitHub REST API, because `gh pr` and `gh issue` fail in cloud sessions).
- Merge only when CI is green. Never push to `main`, never force-push `main`, never merge a partial step with failing tests.
- Merge method: rebase. Sign off every commit (`git commit -s`); a DCO check runs on every PR.
- Zips uploaded by the owner are unpacked by `.github/workflows/unpack-zip.yml`. That workflow cannot change files in `.github/workflows/`; workflow changes ship in a normal PR.

## Non-negotiables
- **Rules are data, setups are data.** Never hardcode a piece rule, a starting square, or a setup constraint. Read them from `rules/` and the selected ruleset.
- **Board geometry is standard.** Store and compute positions in ordinary a1 to h8 coordinates. The 45° turn is a rendering concern only.
- **Test every parameter** at its default and at each option. Test every setup constraint with legal and illegal arrangements.
- **Official rulesets and presets are immutable.** Changes ship as a new version.
- **Record what was played.** Every saved game keeps the ruleset id and version and both players' setups, so results can be grouped by setup.
- **Public repo hygiene.** No secrets, no personal information (names, emails, addresses), no unreleased art. Never read `.env` or private paths. Don't create art.
- **Dependencies.** Only permissive licenses (MIT, BSD, Apache-2.0, ISC). Never GPL, LGPL, or AGPL (so no Stockfish or Fairy-Stockfish). List third-party components in NOTICE.
- **Naming.** Product text says "Apex Chess". apexchess.icu is the web address. Use the owner's terms: chord (side to side), ray (forward and back), front chord, Player's Choice, The Elbow Room.

## Stack
TypeScript, pnpm workspaces (`packages/engine`, `apps/web`, `packages/sim`), Vite + React static SPA, Vitest, Node 22. Hosting: Cloudflare, provisional.

## Commands
`pnpm install`, `pnpm dev` (web app), `pnpm build`, `pnpm test` (Vitest, all packages), `pnpm lint` (ESLint + Prettier check; `pnpm exec prettier --write .` to fix), `pnpm typecheck`, `pnpm validate:rules` (Ajv: `rules/<kind>/*.json` against `rules/schema/<kind>.schema.json`), `pnpm sim` (bot self-play report; `--pool --games --depth --nodes --seed --cap --jobs --report`).

## Where things live
- `docs/HANDOFF.md`: current state and the next session (rewritten every session). `docs/sessions/LOG.md`: one line per session.
- `docs/BUILD-PLAN.md`: every step, its model and effort, done-when checks, decision defaults, and the ledger-sync format.
- `docs/RULES.md`: the rules in words. `rules/` (from S6): parameters, rulesets, setups, and their schemas.
- `.claude/rules/`: extra instructions that load only when you touch matching paths.
- `docs/DEV-WORKFLOW.md`: setup and repository settings. `docs/decisions/`: lasting decisions.

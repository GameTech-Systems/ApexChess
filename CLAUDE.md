# Apex Chess (ApexChess repo): project memory for Claude Code

@docs/HANDOFF.md

## What this is
Apex Chess is a chess variant: the standard pieces on a standard 8×8 board turned 45°, so each king starts in its own light corner (h1 and a8). Players can bring their own starting arrangement (Player's Choice, `docs/RULES.md` section 4), and online opponents see each other's arrangement only when the game begins. Rules and setups are data, so new setups, presets, and rule sets are easy to add. Gameplay lives at apexchess.icu. This repo is public and source-available (PolyForm Shield 1.0.0), never "open source".

## Session protocol
1. **Start** with `/start-session S<n>`. One build-plan step per session, one pull request per step. The step list is `docs/BUILD-PLAN.md`; read only your step's section.
2. **Model and effort** come from the step (or the owner's pasted ledger brief). If the session runs on something else, give the owner the exact commands (`/model sonnet`, `/effort medium`) at the top of your first reply. Don't switch models mid-session yourself: it drops the prompt cache.
3. **Plan** before any change that touches several files: write the plan in your reply and go ahead without waiting for approval. Don't use plan mode. **Write the failing test first.** Commit after every green task.
4. **End** automatically with `/end-session` when the step is done. Keep replies brief: facts, plus problems the owner must resolve before the next session. If usage is running low, run it early; unfinished work stays on its branch.

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

## Stack (planned; S5 scaffolds it)
TypeScript, pnpm workspaces (`packages/engine`, `apps/web`, later `packages/sim`), Vite + React static SPA, Vitest, Node 22. Hosting: Cloudflare, provisional.

## Commands
None until S5. S5 adds `pnpm dev`, `build`, `test`, `lint`, `typecheck`, and `validate:rules`, and writes them here.

## Where things live
- `docs/HANDOFF.md`: current state and the next session (rewritten every session). `docs/sessions/LOG.md`: one line per session.
- `docs/BUILD-PLAN.md`: every step, its model and effort, done-when checks, decision defaults, and the ledger-sync format.
- `docs/RULES.md`: the rules in words. `rules/` (from S6): parameters, rulesets, setups, and their schemas.
- `.claude/rules/`: extra instructions that load only when you touch matching paths.
- `docs/DEV-WORKFLOW.md`: setup and repository settings. `docs/decisions/`: lasting decisions.

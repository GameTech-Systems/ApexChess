---
name: start-session
description: Start an Apex Chess build session for one step of docs/BUILD-PLAN.md. Use at the beginning of every Claude Code session, with the step id (for example S5) and optionally the owner's pasted ledger brief.
argument-hint: S<number>
disable-model-invocation: true
---

Start build step $ARGUMENTS.

1. **Orient cheaply.** `docs/HANDOFF.md` is already loaded through CLAUDE.md. Read only the `### $ARGUMENTS ` section of `docs/BUILD-PLAN.md` (from that heading to the next `### ` heading) and the rows of the "Decision defaults" table that the step names. Read `docs/RULES.md` only when the step touches rules or setups, and then only the sections it needs.
2. **Apply the owner's brief.** If the owner's message includes a "Ledger brief", its decisions and notes override the defaults table. Keep a list of changed public decisions for `/end-session`. Never copy private notes into the repo.
3. **Check model and effort.** The step names a model and effort. If this session runs on something else, put the exact commands at the top of your first reply (for example `/model opus` then `/effort high`) and continue in plan mode so the owner can switch before you edit files.
4. **Branch.** Never work on `main`. Sign off every commit (`git commit -s`). Cloud sessions start on a `claude/...` branch; otherwise create `claude/<step-id>-<short-slug>`.
5. **Plan.** For any multi-file change, write the plan in your reply and proceed without waiting for approval; don't use plan mode. The plan lists the files to touch, the failing tests you will write first, the step's done-when checks, and the decision defaults you will apply.
6. **Defaults, not stalls.** For an open decision, apply its default, mark it provisional (in the data's `source` or `notes`, or a code comment), and keep going. Ask only when no default and no listed option fits; then record the question for the handoff and finish the rest of the step.
7. **Stay in scope.** One step per session. If you finish early, run `/end-session` instead of starting the next step.

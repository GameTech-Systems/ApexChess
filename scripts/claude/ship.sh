#!/usr/bin/env bash
# Push the current branch, open (or reuse) its pull request, wait for CI, and merge it.
# Uses the GitHub REST API through `gh api`, because `gh pr` (GraphQL) is blocked in
# Claude Code cloud sessions.
#
# Usage: scripts/claude/ship.sh [--no-merge] "<PR title>" <body-file>
# Env:   MERGE_METHOD (default: rebase, decision record 0001), CHECK_TIMEOUT_SEC (default: 900)
set -euo pipefail

REPO="${REPO:-GameTech-Systems/ApexChess}"
METHOD="${MERGE_METHOD:-rebase}"
TIMEOUT="${CHECK_TIMEOUT_SEC:-900}"
MERGE=1
if [ "${1:-}" = "--no-merge" ]; then MERGE=0; shift; fi
TITLE="${1:?PR title required}"
BODY_FILE="${2:?PR body file required}"

BRANCH="$(git branch --show-current)"
if [ -z "$BRANCH" ] || [ "$BRANCH" = "main" ]; then
  echo "ship: refusing to ship from '${BRANCH:-detached HEAD}'. Work on a claude/... branch." >&2
  exit 1
fi

git fetch origin main --quiet
if ! git merge-base --is-ancestor origin/main HEAD; then
  echo "ship: branch is behind origin/main. Rebase first: git rebase origin/main" >&2
  exit 1
fi
git push -u origin "$BRANCH"

OWNER="${REPO%%/*}"
PR="$(gh api "repos/$REPO/pulls?head=$OWNER:$BRANCH&state=open" --jq '.[0].number // empty')"
if [ -z "$PR" ]; then
  DRAFT=false; [ "$MERGE" = 0 ] && DRAFT=true
  PR="$(gh api -X POST "repos/$REPO/pulls" -f title="$TITLE" -f head="$BRANCH" -f base=main \
        -F body=@"$BODY_FILE" -F draft="$DRAFT" --jq .number)"
  echo "ship: opened PR #$PR"
else
  echo "ship: reusing PR #$PR"
fi

if [ "$MERGE" = 0 ]; then
  echo "ship: left PR #$PR open (--no-merge)."
  exit 0
fi

SHA="$(git rev-parse HEAD)"
echo "ship: waiting for checks on $SHA (up to ${TIMEOUT}s)"
waited=0; seen=0
COUNTS='"\(.total_count) \([.check_runs[] | select(.status != "completed")] | length) \([.check_runs[] | select(.conclusion == "failure" or .conclusion == "cancelled" or .conclusion == "timed_out" or .conclusion == "action_required" or .conclusion == "stale")] | length)"'
while :; do
  read -r total pending failed <<<"$(gh api "repos/$REPO/commits/$SHA/check-runs?per_page=100" --jq "$COUNTS")"
  if [ "$total" -gt 0 ]; then
    seen=1
    if [ "$failed" -gt 0 ]; then
      echo "ship: CI failed on PR #$PR. Not merging." >&2
      exit 2
    fi
    [ "$pending" -eq 0 ] && break
  elif [ "$waited" -ge 120 ] && [ "$seen" = 0 ]; then
    echo "ship: no checks reported after 120s; continuing (branch rules still apply)."
    break
  fi
  if [ "$waited" -ge "$TIMEOUT" ]; then
    echo "ship: checks still running after ${TIMEOUT}s. PR #$PR left open." >&2
    exit 3
  fi
  sleep 15; waited=$((waited + 15))
done

gh api -X PUT "repos/$REPO/pulls/$PR/merge" -f merge_method="$METHOD" --jq '.message'
git fetch origin main --quiet
echo "ship: PR #$PR merged into main ($METHOD)."

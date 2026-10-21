#!/usr/bin/env bash
# SessionStart hook: in Claude Code cloud sessions, install dependencies when the
# lockfile changed since the last install. Does nothing locally or before S5.
# Anything printed here is added to Claude's context, so stay quiet.

[ "${CLAUDE_CODE_REMOTE:-}" = "true" ] || exit 0
cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0
[ -f pnpm-lock.yaml ] || exit 0

stamp=node_modules/.lock.sha256
want="$(sha256sum pnpm-lock.yaml scripts/claude/session-start.sh | sha256sum | cut -d' ' -f1)"
if [ -f "$stamp" ] && [ "$(cat "$stamp")" = "$want" ]; then exit 0; fi

rm -f "$stamp"
if pnpm install --frozen-lockfile >/tmp/pnpm-install.log 2>&1; then
  echo "$want" >"$stamp"
  echo "Dependencies installed (pnpm)."
else
  echo "pnpm install failed; see /tmp/pnpm-install.log"
fi
exit 0

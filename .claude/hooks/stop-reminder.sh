#!/usr/bin/env bash
# Stop hook. When the working tree has uncommitted changes to source files at
# the end of a turn, remind the agent (non-blocking) of the definition of done
# in core/ai-workflow.mdc. Exit 0 always; the message goes to stdout so it is
# shown in the transcript.
set -uo pipefail
root="${CLAUDE_PROJECT_DIR:-$(pwd)}"
cd "$root" 2>/dev/null || exit 0
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || exit 0

changed="$(git status --porcelain 2>/dev/null | grep -Evc '^\?\? (\.claude|graphify-out)/')"
[[ "$changed" == "0" ]] && exit 0

cat <<EOF
Reminder (core/ai-workflow.mdc): $changed changed path(s) are uncommitted.
Before reporting done: check command run and green, tests added per
core/testing.mdc, docs/PROJECT.md/TEST_PLAN.md updated, diff re-read, and
the report lists what was verified and what was not.
EOF
exit 0

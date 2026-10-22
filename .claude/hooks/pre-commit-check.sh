#!/usr/bin/env bash
# PreToolUse hook (matcher: Bash). Blocks `git commit` unless the project's
# check command passes. Exit 2 = block the tool call and feed stderr to the
# agent. Invalid hook input and missing verification configuration block with
# an actionable error. Non-commit commands with valid input remain unaffected.
#
# The check command is resolved, in order, from:
#   1. $CHECK_COMMAND
#   2. .claude/check-command (one line)
#   3. package.json "check" script -> pnpm/npm/yarn/bun check
#   4. Makefile target "check" -> make check
#   5. Cargo.toml -> cargo fmt --check && cargo clippy -D warnings && cargo test
#   6. go.mod -> go vet ./... && go test ./...
#   7. pyproject.toml -> ruff check . && pyright && pytest
#   8. build.gradle.kts -> ./gradlew check
set -uo pipefail

input="$(cat)"
if ! command="$(printf '%s' "$input" | python3 -c '
import json, sys
value = json.load(sys.stdin)["tool_input"]["command"]
if not isinstance(value, str) or not value.strip():
    sys.exit(1)
print(value)
' 2>/dev/null)"; then
  echo "Blocked: cannot parse hook input. Check Python 3 and the Bash hook payload." >&2
  exit 2
fi

# Check recognized git commit commands, including --amend; this is not a shell sandbox.
if ! printf '%s' "$command" | grep -Eq '(^|[;&|[:space:]])git[[:space:]]+(-C[[:space:]]+[^[:space:]]+[[:space:]]+)?commit([[:space:]]|$)'; then
  exit 0
fi

if printf '%s' "$command" | grep -Eq -- '--no-verify|-n([[:space:]]|$)'; then
  echo "Blocked: never bypass the check with --no-verify (core/ai-workflow.mdc)." >&2
  exit 2
fi

root="${CLAUDE_PROJECT_DIR:-$(pwd)}"
cd "$root" || { echo "Blocked: cannot access project directory for verification." >&2; exit 2; }

resolve_check() {
  if [[ -n "${CHECK_COMMAND:-}" ]]; then echo "$CHECK_COMMAND"; return; fi
  if [[ -f .claude/check-command ]]; then head -n1 .claude/check-command; return; fi
  if [[ -f package.json ]] && grep -q '"check"' package.json; then
    if [[ -f pnpm-lock.yaml ]]; then echo "pnpm check"; return; fi
    if [[ -f bun.lockb || -f bun.lock ]]; then echo "bun run check"; return; fi
    if [[ -f yarn.lock ]]; then echo "yarn check"; return; fi
    echo "npm run check"; return
  fi
  if [[ -f Makefile ]] && grep -Eq '^check:' Makefile; then echo "make check"; return; fi
  if [[ -f Cargo.toml ]]; then echo "cargo fmt --check && cargo clippy --all-targets -- -D warnings && cargo test"; return; fi
  if [[ -f go.mod ]]; then echo "gofmt -l . | (! grep .) && go vet ./... && go test -race ./..."; return; fi
  if [[ -f pyproject.toml ]]; then echo "ruff format --check . && ruff check . && pyright && pytest"; return; fi
  if [[ -f build.gradle.kts || -f build.gradle ]]; then echo "./gradlew check"; return; fi
  echo ""
}

check="$(resolve_check)"
if [[ ! "$check" =~ [^[:space:]] ]]; then
  echo "Blocked: no check command configured. Set CHECK_COMMAND or put the project's verification command in .claude/check-command, then retry." >&2
  exit 2
fi

umask 077
log_file="$(mktemp "${TMPDIR:-/tmp}/claude-check.XXXXXX")" || { echo "Blocked: cannot create verification log." >&2; exit 2; }
trap 'rm -f -- "$log_file"' EXIT
echo "Running check before commit: $check" >&2
if bash -c "$check" >"$log_file" 2>&1; then
  exit 0
fi

echo "Blocked: check command failed ($check). Fix the failures before committing. Last 60 lines:" >&2
tail -n 60 "$log_file" >&2
exit 2

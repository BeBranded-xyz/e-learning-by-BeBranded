#!/usr/bin/env bash
# PreToolUse hook (matcher: Write|Edit|MultiEdit). Blocks writes whose content
# looks like it contains a real secret, and any write to a .env file that is
# not an example file. Exit 2 = block. Patterns are deliberately conservative
# to avoid false positives on placeholders like {{...}}, "xxx", or "example".
set -uo pipefail

input="$(cat)"
parsed="$(INPUT="$input" python3 - <<'PY'
import base64, json, os, sys
try:
    d = json.loads(os.environ.get("INPUT", "") or "{}")
except (ValueError, TypeError):
    sys.exit(1)
ti = d["tool_input"]
fp = ti["file_path"]
if not isinstance(fp, str) or not fp.strip():
    sys.exit(1)
parts = []
for k in ("content", "new_string"):
    if k in ti:
        if not isinstance(ti[k], str): sys.exit(1)
        parts.append(ti[k])
for e in ti.get("edits", []) or []:
    value = e["new_string"]
    if not isinstance(value, str): sys.exit(1)
    parts.append(value)
if not parts:
    sys.exit(1)
print(fp.replace("\n", " "))
print(base64.b64encode("\n".join(parts).encode()).decode())
PY
)" 2>/dev/null || { echo "Blocked: cannot inspect write payload. Check Python 3 and the write hook configuration." >&2; exit 2; }
file_path="$(printf '%s\n' "$parsed" | sed -n 1p)"
decoded="$(printf '%s\n' "$parsed" | sed -n 2p | base64 -d 2>/dev/null)" || { echo "Blocked: cannot decode write content for secret scanning." >&2; exit 2; }
[[ -z "$file_path" ]] && { echo "Blocked: write payload has no file path." >&2; exit 2; }

base="$(basename "$file_path")"

# 1. Never write real env files. Example files are fine.
if [[ "$base" =~ ^\.env(\..+)?$ ]] && [[ ! "$base" =~ (example|sample|template)$ ]]; then
  echo "Blocked: writing $base. Real env files are never written by the agent (core/security.mdc). Edit .env.example instead and ask the user to set the value." >&2
  exit 2
fi

# 2. Scan all file types, including docs, examples, and fixtures. Use visibly
# fake placeholders there, never strings matching credential formats.
# High-confidence secret formats (provider-prefixed tokens, private keys).
patterns=(
  'AKIA[0-9A-Z]{16}'                              # AWS access key id
  'sk_live_[0-9a-zA-Z]{20,}'                      # Stripe live secret
  'sk-ant-[0-9a-zA-Z_-]{20,}'                     # Anthropic
  'sk-[0-9a-zA-Z]{32,}'                           # OpenAI-style
  'gh[pousr]_[0-9A-Za-z]{30,}'                    # GitHub tokens
  'xox[baprs]-[0-9A-Za-z-]{10,}'                  # Slack
  'eyJ[0-9A-Za-z_-]{20,}\.[0-9A-Za-z_-]{20,}\.[0-9A-Za-z_-]{20,}' # JWT with 3 real parts
  '-----BEGIN (RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----'
  'AIza[0-9A-Za-z_-]{35}'                         # Google API key
  'SG\.[0-9A-Za-z_-]{22}\.[0-9A-Za-z_-]{43}'      # SendGrid
  'sbp_[0-9a-f]{40}'                              # Supabase PAT
  'postgres(ql)?://[^:/[:space:]]+:[^@[:space:]]{8,}@' # DB URL with password
)
for p in "${patterns[@]}"; do
  if printf '%s' "$decoded" | grep -Eq -e "$p"; then
    echo "Blocked: content of $base matches a secret pattern ($p). Secrets never go in code (core/security.mdc). Use an env var and document it in .env.example." >&2
    exit 2
  fi
done

# 4. Assignments of long random-looking values to secret-named keys, excluding placeholders.
if printf '%s' "$decoded" | grep -Ei '(secret|password|passwd|api[_-]?key|token|private[_-]?key)["'"'"']?[[:space:]]*[:=][[:space:]]*["'"'"'][0-9A-Za-z+/_=-]{24,}["'"'"']' \
   | grep -Evi '(\{\{|example|placeholder|xxx|changeme|your[_-]|dummy|test[_-]?value|process\.env|import\.meta\.env|os\.environ|getenv|\$\{)' | grep -q .; then
  echo "Blocked: $base assigns a long literal to a secret-named key. Read it from the environment instead (core/security.mdc)." >&2
  exit 2
fi

exit 0

#!/usr/bin/env bash
# Watch a canary's error rate and p95 latency for a window and fail on breach
# (modules/releases.mdc, "automated rollback"). Platform-agnostic: it polls an
# HTTP endpoint that returns JSON {"error_rate": <0..1>, "p95_ms": <number>}.
# Point SLO_METRICS_URL at a small endpoint or proxy in front of the
# observability tool (Sentry, PostHog, Vercel, Cloudflare analytics...).
#
#   scripts/watch-slo.sh --window 10m --max-error-rate 1% --max-p95 500ms [--interval 30s]
#
# Env: SLO_METRICS_URL (required), SLO_METRICS_TOKEN (optional bearer token).
set -euo pipefail

window="10m"; max_err="1%"; max_p95="500ms"; interval="30s"
while [[ $# -gt 0 ]]; do
  case "$1" in
    --window) window="$2"; shift 2 ;;
    --max-error-rate) max_err="$2"; shift 2 ;;
    --max-p95) max_p95="$2"; shift 2 ;;
    --interval) interval="$2"; shift 2 ;;
    *) echo "Unknown argument: $1" >&2; exit 2 ;;
  esac
done
: "${SLO_METRICS_URL:?SLO_METRICS_URL is required}"

to_seconds() { # 10m -> 600, 30s -> 30, 1h -> 3600
  local v="$1"
  case "$v" in
    *h) echo $(( ${v%h} * 3600 )) ;;
    *m) echo $(( ${v%m} * 60 )) ;;
    *s) echo "${v%s}" ;;
    *) echo "$v" ;;
  esac
}
err_limit="$(python3 -c "print(float('${max_err%\%}')/100)")"
p95_limit="${max_p95%ms}"
total="$(to_seconds "$window")"; step="$(to_seconds "$interval")"
deadline=$(( $(date +%s) + total ))

echo "Watching $SLO_METRICS_URL for ${window}: error_rate <= ${max_err}, p95 <= ${max_p95}"
while (( $(date +%s) < deadline )); do
  auth=()
  [[ -n "${SLO_METRICS_TOKEN:-}" ]] && auth=(-H "Authorization: Bearer $SLO_METRICS_TOKEN")
  body="$(curl -fsS --max-time 20 "${auth[@]}" "$SLO_METRICS_URL" || true)"
  if [[ -z "$body" ]]; then
    echo "warn: metrics endpoint unreachable, retrying" >&2
  else
    read -r err p95 < <(printf '%s' "$body" | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d.get("error_rate",0), d.get("p95_ms",0))')
    echo "$(date -u +%H:%M:%S) error_rate=$err p95_ms=$p95"
    if python3 -c "import sys; sys.exit(0 if float('$err') > float('$err_limit') or float('$p95') > float('$p95_limit') else 1)"; then
      echo "SLO breach: error_rate=$err (limit $err_limit) p95_ms=$p95 (limit $p95_limit). Rolling back." >&2
      exit 1
    fi
  fi
  sleep "$step"
done
echo "Canary healthy for ${window}."

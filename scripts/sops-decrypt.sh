#!/usr/bin/env bash
set -euo pipefail
LOG_PREFIX="[sops-decrypt-pre]"
ENV="${TASTILE_ENV:-}"
for arg in "$@"; do
  case "$arg" in
    --env=*) ENV="${arg#--env=}";;
  esac
done
if [ -z "$ENV" ]; then
  echo "$LOG_PREFIX FATAL: --env=<env> or TASTILE_ENV is required" >&2
  exit 2
fi
echo "$LOG_PREFIX starting decrypt env=$ENV at $(date -u +%Y-%m-%dT%H:%M:%SZ)"
if ! command -v sops >/dev/null; then
  echo "$LOG_PREFIX FATAL: sops not installed" >&2
  exit 2
fi
exec bun run /opt/tastile-web/scripts/sops-decrypt.ts --env="$ENV"

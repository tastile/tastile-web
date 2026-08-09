#!/bin/bash
# Boot the e2e stack: wslc v1 stack (postgres + api + worker) + Next.js dev server.
# Records readiness state to docs/plans/evidence/<run-id>/boot.md.
#
# Usage:
#   bash scripts/e2e/up-stack.sh [run-id]
#
# Defaults: run-id = 2026-08-09-usecase-e2e-30
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WEB_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
CORE_ROOT="$(cd "$WEB_ROOT/../tastile-core" && pwd)"
RUN_ID="${1:-2026-08-09-usecase-e2e-30}"
EVIDENCE_DIR="$WEB_ROOT/docs/plans/evidence/$RUN_ID"

mkdir -p "$EVIDENCE_DIR"
BOOT_MD="$EVIDENCE_DIR/boot.md"

cd "$WEB_ROOT"

{
  echo "# Boot evidence ($RUN_ID)"
  echo
  echo "Generated: $(date -Iseconds)"
  echo

  echo "## wslc stack status"
  echo
  echo '```'
  wslc container ls 2>&1 | head -30 || echo "(wslc not available)"
  echo '```'
  echo

  echo "## Bring up v1 stack (postgres + api + worker)"
  echo
  bash "$CORE_ROOT/scripts/wslc/up-v1.sh" 2>&1 | tail -20
  echo

  echo "## Wait for /v1/ready"
  echo
  for i in 1 2 3 4 5 6; do
    body="$(wslc container exec tastile-dev-api curl -s http://127.0.0.1:31400/v1/ready || true)"
    echo "attempt $i: ${body:-<no response>}"
    if echo "$body" | grep -q '"status":"ready"'; then break; fi
    sleep 5
  done
  echo

  echo "## Migration version (max)"
  echo
  echo '```'
  wslc container exec tastile-db psql -U tastile -d tastile_db -tA -c "SELECT max(version) FROM v1_migration;" 2>&1
  echo '```'
  echo

  echo "## Next.js dev server"
  echo
  # Kill any prior dev server on 3000 to keep this idempotent
  if [ -f "$EVIDENCE_DIR/dev-server.pid" ]; then
    kill "$(cat "$EVIDENCE_DIR/dev-server.pid")" 2>/dev/null || true
  fi
  nohup bun run dev > "$EVIDENCE_DIR/dev-server.log" 2>&1 &
  echo $! > "$EVIDENCE_DIR/dev-server.pid"
  echo "dev-server pid=$(cat "$EVIDENCE_DIR/dev-server.pid")"
  for i in 1 2 3 4 5 6 7 8 9 10 11 12; do
    code="$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3000/dashboard || echo 000)"
    echo "dashboard probe $i: http=$code"
    if [ "$code" != "000" ]; then break; fi
    sleep 5
  done
  echo
} > "$BOOT_MD"

echo "Boot evidence written to $BOOT_MD"

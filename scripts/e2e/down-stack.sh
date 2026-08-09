#!/bin/bash
# Tear down only the Next.js dev server.  Leaves wslc containers running
# so subsequent runs can reuse the v1 stack.  Use bash
# tastile-core/scripts/wslc/down.sh to fully tear down the v1 stack.
#
# Usage:
#   bash scripts/e2e/down-stack.sh [run-id]
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WEB_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
RUN_ID="${1:-2026-08-09-usecase-e2e-30}"
EVIDENCE_DIR="$WEB_ROOT/docs/plans/evidence/$RUN_ID"

cd "$WEB_ROOT"

if [ -f "$EVIDENCE_DIR/dev-server.pid" ]; then
  PID="$(cat "$EVIDENCE_DIR/dev-server.pid")"
  if kill -0 "$PID" 2>/dev/null; then
    kill "$PID" 2>/dev/null || true
    sleep 1
    if kill -0 "$PID" 2>/dev/null; then
      kill -9 "$PID" 2>/dev/null || true
    fi
    echo "killed dev-server pid=$PID"
  else
    echo "dev-server pid=$PID not running"
  fi
  rm -f "$EVIDENCE_DIR/dev-server.pid"
else
  echo "no pid file at $EVIDENCE_DIR/dev-server.pid"
fi

# Defensive: kill any stray `bun run dev` listeners on :3000
for p in $(lsof -ti:3000 2>/dev/null || true); do
  kill "$p" 2>/dev/null || true
  echo "killed stray listener pid=$p"
done

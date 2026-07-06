#!/usr/bin/env bash
# Bring up the tastile-web container on host port 3000.
# Assumes the tastile-core wslc stack is already up (postgres + api + worker
# on host port 31400). The shared 'tastile-net' network is created by
# tastile-core.wslc/scripts/wslc/bootstrap.sh.
set -euo pipefail

command -v wslc >/dev/null 2>&1 || { echo "ERROR: wslc CLI not found in PATH. Install Microsoft June 2026 preview."; exit 1; }

CONTAINER="tastile-web"
IMAGE="tastile-web"
NETWORK="tastile-net"
HOST_PORT=3000
CONTAINER_PORT=3000

# Pre-check: image must exist (build first if missing).
if ! wslc images -q 2>/dev/null | grep -q "^$IMAGE\$"; then
  echo "ERROR: image '$IMAGE' not found. Run scripts/wslc/build.sh first."
  exit 1
fi

# Pre-check: network must exist (shared with core; do not auto-create here).
if ! wslc network ls -q 2>/dev/null | grep -q "^$NETWORK\$"; then
  echo "ERROR: wslc network '$NETWORK' missing."
  echo "Hint: run 'tastile-core.wslc/scripts/wslc/bootstrap.sh' (one-time) or 'tastile-core.wslc/scripts/wslc/up-v1.sh'."
  exit 1
fi

# Pre-clean: remove any existing container with the same name to avoid collision.
if wslc list -a -q 2>/dev/null | grep -q "^$CONTAINER\$"; then
  echo "Removing existing $CONTAINER container..."
  wslc stop "$CONTAINER" >/dev/null 2>&1 || true
  wslc rm "$CONTAINER" >/dev/null 2>&1 || true
fi

echo "== web =="
wslc run -d --name "$CONTAINER" --network "$NETWORK" \
  -p "$HOST_PORT:$CONTAINER_PORT" \
  "$IMAGE"

sleep 2
wslc logs --tail 20 "$CONTAINER" || true

echo "tastile-web running at http://localhost:$HOST_PORT"

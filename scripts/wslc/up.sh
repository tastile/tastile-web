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
# Note: wslc images -q emits IMAGE IDs (sha256), not repo names — parse the
# table to get the REPOSITORY column instead. wslc 2.9.3.0 does not support
# `--format '{{.Repository}}:{{.Tag}}'` (only json/table), so we awk the
# table directly.
if ! wslc images 2>/dev/null | awk 'NR>1 && $1 != "<none>" {print $1 ":" $2}' | grep -q "^$IMAGE:\$\|^$IMAGE:latest\$"; then
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

# Env injection. CLOUD_API_BASE points at the api by container name inside
# the shared wslc network — no host-port mapping needed. The bridge secret
# must be supplied by the operator; we do NOT bake it into the image.
# NOTE: NEXT_PUBLIC_* values are baked into the SSR bundle at image build
# time (Next.js standard). They come from .env.dev at build; passing them
# here at runtime has no effect on the rendered values.
: "${CLOUD_API_BASE:=http://tastile-v1-api:31400}"
: "${TASTILE_WEB_BRIDGE_SECRET:=wslc-dev-bridge-secret}"
: "${TASTILE_USE_RUST_CORE:=1}"
: "${E2E_BYPASS_AUTH:=1}"

echo "== web =="
wslc run -d --name "$CONTAINER" --network "$NETWORK" \
  -p "$HOST_PORT:$CONTAINER_PORT" \
  -e "CLOUD_API_BASE=$CLOUD_API_BASE" \
  -e "TASTILE_WEB_BRIDGE_SECRET=$TASTILE_WEB_BRIDGE_SECRET" \
  -e "TASTILE_USE_RUST_CORE=$TASTILE_USE_RUST_CORE" \
  -e "E2E_BYPASS_AUTH=$E2E_BYPASS_AUTH" \
  "$IMAGE"

sleep 2
wslc logs --tail 20 "$CONTAINER" || true

echo "tastile-web running at http://localhost:$HOST_PORT"

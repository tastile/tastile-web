#!/bin/bash
# Boot the e2e stack: wslc v1 stack (postgres + api + worker) + Next.js dev server.
# Records readiness state to docs/plans/evidence/<run-id>/boot.md.
#
# Dependency: requires `tastile-v1-api:latest` wslc image to exist locally
# (built once via `bash tastile-core/scripts/wslc/build.sh`).
#
# Usage:
#   bash scripts/e2e/up-stack.sh [run-id]
#
# Defaults: run-id = 2026-08-09-usecase-e2e-30
#
# Build-before-boot contract (per tastile-core/scripts/wslc/README.md §Troubleshooting):
#   "API container exits immediately | The application image was not built first"
#   If the image is missing locally AND the host cannot build (Defender blocks
#   cc1.exe on Windows per `project_windows_defender_blocks_cc1.md`), the script
#   exits non-zero with the CI ubuntu-latest path as the recovery option.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WEB_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
CORE_ROOT="$(cd "$WEB_ROOT/../tastile-core" && pwd)"
RUN_ID="${1:-2026-08-09-usecase-e2e-30}"
EVIDENCE_DIR="$WEB_ROOT/docs/plans/evidence/$RUN_ID"
IMAGE_NAME="${TASTILE_IMAGE_NAME:-tastile-v1-api}"
IMAGE_TAG="${TASTILE_IMAGE_TAG:-latest}"

mkdir -p "$EVIDENCE_DIR"
BOOT_MD="$EVIDENCE_DIR/boot.md"

cd "$WEB_ROOT"

{
  echo "# Boot evidence ($RUN_ID)"
  echo
  echo "Generated: $(date -Iseconds)"
  echo

  echo "## Image presence ($IMAGE_NAME:$IMAGE_TAG)"
  echo
  echo '```'
  if wslc images 2>/dev/null | grep -qF "$IMAGE_NAME"; then
    wslc images 2>&1 | grep -F "$IMAGE_NAME" || true
    echo "(image present)"
  else
    echo "(image MISSING — see Recovery section below)"
  fi
  echo '```'
  echo

  if ! wslc images 2>/dev/null | grep -qF "$IMAGE_NAME"; then
    echo "## Recovery: image missing"
    echo
    echo "The wslc image \`$IMAGE_NAME:$IMAGE_TAG\` was not found locally."
    echo
    echo "Canonical build path (Git Bash, on a build-capable host):"
    echo
    echo '```bash'
    echo "cd \"$CORE_ROOT\""
    echo "bash scripts/wslc/build.sh"
    echo '```'
    echo
    echo "PowerShell alternative:"
    echo
    echo '```powershell'
    echo "cd $CORE_ROOT"
    echo ".wslc\\wslc-build.ps1"
    echo '```'
    echo
    echo "If this host blocks \`cargo build\` (Windows Defender hash-blocks"
    echo "\`cc1.exe\`; see \`project_windows_defender_blocks_cc1.md\`), the build"
    echo "must run in **CI ubuntu-latest** (the source of truth). Pull the"
    echo "produced image from the registry that hosts it, or copy"
    echo "\`tastile-v1-api:\$TAG\` from a build container, then re-run this script."
    echo
    echo "Skipping \`up-v1.sh\` because the image is absent — the api container"
    echo "would exit immediately and produce no \`/v1/ready\` probe success."
    echo
    echo "Stack status: NOT_BOOTED (image missing)"
    echo
    # Write a sidecar JSON for machine consumers and exit non-zero so the
    # caller (run-spec.sh / CI) can branch on it without parsing boot.md.
    cat > "$EVIDENCE_DIR/boot-status.json" <<JSON
{
  "stack_status": "NOT_BOOTED",
  "reason": "missing image",
  "image": "$IMAGE_NAME:$IMAGE_TAG",
  "evidence_dir": "$EVIDENCE_DIR"
}
JSON
    exit 2
  fi

  echo "## wslc stack status (pre-boot)"
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
    body="$(wslc container exec tastile-api curl -s http://127.0.0.1:31400/v1/ready || true)"
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

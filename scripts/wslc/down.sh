#!/usr/bin/env bash
# Stop + remove the tastile-web wslc container. Image is preserved.
set -euo pipefail

command -v wslc >/dev/null 2>&1 || { echo "ERROR: wslc CLI not found in PATH. Install Microsoft June 2026 preview."; exit 1; }

CONTAINERS=(
  tastile-web
)

for c in "${CONTAINERS[@]}"; do
  if wslc list -a -q 2>/dev/null | grep -q "^$c\$"; then
    if wslc list -q 2>/dev/null | grep -q "^$c\$"; then
      echo "Stopping $c..."
      wslc stop "$c" >/dev/null 2>&1 || true
    fi
    echo "Removing $c..."
    wslc rm -f "$c" >/dev/null 2>&1 || true
  else
    echo "$c: not present (skipping)."
  fi
done

echo "tastile-web down."

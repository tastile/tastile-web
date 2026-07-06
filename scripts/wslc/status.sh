#!/usr/bin/env bash
# Show state of the tastile-web wslc container, image, and shared network.
set -euo pipefail

command -v wslc >/dev/null 2>&1 || { echo "ERROR: wslc CLI not found in PATH. Install Microsoft June 2026 preview."; exit 1; }

CONTAINER="tastile-web"
IMAGE="tastile-web"
NETWORK="tastile-net"

# Container state
if wslc list -a -q 2>/dev/null | grep -q "^$CONTAINER\$"; then
  if wslc list -q 2>/dev/null | grep -q "^$CONTAINER\$"; then
    c_state="running"
  else
    c_state="stopped"
  fi
else
  c_state="not created"
fi

# Image presence
if wslc images -q 2>/dev/null | grep -q "^$IMAGE\$"; then
  i_state="present"
else
  i_state="missing"
fi

# Network presence
if wslc network ls -q 2>/dev/null | grep -q "^$NETWORK\$"; then
  n_state="present"
else
  n_state="missing"
fi

printf "%-20s %-15s %s\n" "RESOURCE" "STATE" "NAME"
printf "%-20s %-15s %s\n" "container" "$c_state" "$CONTAINER"
printf "%-20s %-15s %s\n" "image"     "$i_state" "$IMAGE"
printf "%-20s %-15s %s\n" "network"   "$n_state" "$NETWORK"

#!/usr/bin/env bash
# Build the web image via wslc.
# Produces a local OCI image named tastile-web; never pushed.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

echo "== wslc build (web) =="
# APP_VERSION is the canonical web app version (sourced from
# package.json#version). It is inlined into the standalone bundle as
# NEXT_PUBLIC_APP_VERSION at build time, and recorded as an OCI image
# label. Edit only package.json#version — every other surface follows.
APP_VERSION="$(node -p "require('./package.json').version")"
wslc build \
  --build-arg NEXT_PUBLIC_E2E_BYPASS_AUTH=1 \
  --build-arg APP_VERSION="$APP_VERSION" \
  -t tastile-web \
  -f Containerfile .

echo "Build complete. Image: tastile-web (local)."
wslc images tastile-web

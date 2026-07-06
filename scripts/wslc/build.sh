#!/usr/bin/env bash
# Build the web image via wslc.
# Produces a local OCI image named tastile-web; never pushed.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

echo "== wslc build (web) =="
wslc build -t tastile-web -f Containerfile .

echo "Build complete. Image: tastile-web (local)."
wslc images tastile-web

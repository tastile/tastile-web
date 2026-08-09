#!/bin/bash
# Run a single usecase spec with JSON reporter + write evidence md.
#
# Usage:
#   bash scripts/e2e/run-spec.sh <NN> [run-id]
#
# Defaults: run-id = 2026-08-09-usecase-e2e-30
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WEB_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
NN="$1"
RUN_ID="${2:-2026-08-09-usecase-e2e-30}"
EVIDENCE_DIR="$WEB_ROOT/docs/plans/evidence/$RUN_ID"

if [ -z "$NN" ]; then
  echo "usage: $0 <NN> [run-id]" >&2
  exit 2
fi

mkdir -p "$EVIDENCE_DIR"

cd "$WEB_ROOT"

# Resolve slug from spec filename
SPEC_FILE="$(ls e2e/usecase-${NN}-*.spec.ts | head -1 || true)"
if [ -z "$SPEC_FILE" ]; then
  echo "no spec file matching e2e/usecase-${NN}-*.spec.ts" >&2
  exit 3
fi
SLUG="$(basename "$SPEC_FILE" .spec.ts | sed -E "s/^usecase-${NN}-//")"

JSON_OUT="$EVIDENCE_DIR/${NN}-${SLUG}.json"
MD_OUT="$EVIDENCE_DIR/${NN}-${SLUG}.md"

echo "==> running $SPEC_FILE"
bun run test:e2e -- "$SPEC_FILE" --reporter=json > "$JSON_OUT" 2>&1 || true

# Parse pass/fail from JSON
PASS="$(grep -oE '"status":"passed"' "$JSON_OUT" | wc -l)"
FAIL="$(grep -oE '"status":"failed"' "$JSON_OUT" | wc -l)"
TITLE_LINE="$(grep -oE '"title":"[^"]*"' "$JSON_OUT" | head -1 || true)"

{
  echo "# USECASE $NN — $SLUG"
  echo
  echo "Generated: $(date -Iseconds)"
  echo
  echo "Spec file: \`$SPEC_FILE\`"
  echo
  echo "## Playwright result"
  echo
  echo "- $TITLE_LINE"
  echo "- passed=$PASS failed=$FAIL"
  echo
  if [ "$FAIL" -eq 0 ] && [ "$PASS" -gt 0 ]; then
    echo "**Status**: VERIFIED (executed green)"
  elif [ "$FAIL" -gt 0 ]; then
    echo "**Status**: VERIFIED FAILED (executed red; see JSON for failure messages)"
  else
    echo "**Status**: UNVERIFIED (no test cases ran — investigate)"
  fi
  echo
  echo "## JSON trace"
  echo
  echo '```json'
  head -200 "$JSON_OUT" || echo "(no JSON output)"
  echo '```'
} > "$MD_OUT"

echo "wrote $MD_OUT (passed=$PASS failed=$FAIL)"

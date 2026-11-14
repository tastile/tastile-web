#!/usr/bin/env bash
# Seed a local tastile-v2 store for the T13 web adapter and emit a fixed lock.
#
# Inputs (env):
#   TASTILE_V2_CORE_DIR   core checkout containing crates-v2 (must have
#                         examples/generated/scheduler-option.wasm built via
#                         crates-v2/scripts/build-examples.sh)
#   TASTILE_V2_CLI        path to the release tastile-v2 binary
#   TASTILE_V2_STORE_DIR  store directory to create/reuse (default: ./v2-store)
#   TASTILE_V2_LOCK_OUT   lock file output path
#                         (default: <store>/scheduler-option.lock.json)
#
# Records the core checkout SHA next to the lock for evidence.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CORE_DIR="${TASTILE_V2_CORE_DIR:?set TASTILE_V2_CORE_DIR to a tastile-core checkout}"
CLI="${TASTILE_V2_CLI:?set TASTILE_V2_CLI to the tastile-v2 binary}"
STORE="${TASTILE_V2_STORE_DIR:-${ROOT}/v2-store}"
LOCK="${TASTILE_V2_LOCK_OUT:-${STORE}/scheduler-option.lock.json}"

ARTIFACT_JSON="${CORE_DIR}/crates-v2/examples/scheduler-option-producer/artifact.json"
WASM="${CORE_DIR}/crates-v2/examples/generated/scheduler-option.wasm"
COMPOSITION="${ROOT}/fixtures/v2/scheduler-option.composition.json"

for f in "$CLI" "$ARTIFACT_JSON" "$WASM" "$COMPOSITION"; do
  [[ -f "$f" || -x "$f" ]] || { echo "missing: $f" >&2; exit 2; }
done

mkdir -p "$STORE" "$(dirname "$LOCK")"
"$CLI" --store "$STORE" init >/dev/null
"$CLI" --store "$STORE" artifact add "$ARTIFACT_JSON" >/dev/null
"$CLI" --store "$STORE" artifact add "$COMPOSITION" >/dev/null
"$CLI" --store "$STORE" compose build tastile-web/scheduler-option-eval -o "$LOCK" >/dev/null

# Smoke: one golden vector case (anchor_snap_back) must succeed.
SMOKE_OUT="$("$CLI" --store "$STORE" run "$LOCK" \
  --input step_ms=3600000 \
  --input span_ms=1800000 \
  --input origin=1767225600000 \
  --input bounds_start=null \
  --input bounds_end=null \
  --input range_start_ms=1767231000000 \
  --input range_end_ms=1767236400000 \
  --fuel 5000000 --memory-mb 128 --timeout-ms 3000)"
echo "$SMOKE_OUT" | grep -q '"status": "success"' || {
  echo "v2 smoke run failed:" >&2; echo "$SMOKE_OUT" >&2; exit 1;
}
echo "$SMOKE_OUT" | grep -q '"count": 2' || {
  echo "v2 smoke run returned unexpected count" >&2; exit 1;
}

CORE_SHA="$(git -C "$CORE_DIR" rev-parse HEAD 2>/dev/null || echo unknown)"
echo "$CORE_SHA" > "${LOCK}.core-sha"
echo "seeded store=$STORE lock=$LOCK core_sha=$CORE_SHA"

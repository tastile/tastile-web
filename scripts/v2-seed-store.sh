#!/usr/bin/env bash
# Seed a local tastile-v2 store for the T13 web adapter and emit a fixed lock.
#
# Inputs (env):
#   TASTILE_V2_CORE_DIR   core checkout containing crates-v2 (must have
#                         examples/generated/<profile>.wasm built via
#                         crates-v2/scripts/build-examples.sh)
#   TASTILE_V2_CLI        path to the release tastile-v2 binary
#   TASTILE_V2_STORE_DIR  store directory to create/reuse (default: ./v2-store)
#   TASTILE_V2_LOCK_OUT   lock file output path
#                         (default: <store>/<profile>.lock.json)
#   V2_SCHEDULER_PROFILE  artifact profile: `scheduler-option` (default,
#                         legacy containment contract) or `scheduler-v1-expand`
#                         (v1 expand_occurrences_local overlap semantics,
#                         provides status+occurrences)
#
# Records the core checkout SHA next to the lock for evidence.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CORE_DIR="${TASTILE_V2_CORE_DIR:?set TASTILE_V2_CORE_DIR to a tastile-core checkout}"
CLI="${TASTILE_V2_CLI:?set TASTILE_V2_CLI to the tastile-v2 binary}"
PROFILE="${V2_SCHEDULER_PROFILE:-scheduler-option}"
STORE="${TASTILE_V2_STORE_DIR:-${ROOT}/v2-store}"
LOCK="${TASTILE_V2_LOCK_OUT:-${STORE}/${PROFILE}.lock.json}"

case "$PROFILE" in
  scheduler-option)
    COMPOSITION_LOGICAL="tastile-web/scheduler-option-eval"
    ;;
  scheduler-v1-expand)
    COMPOSITION_LOGICAL="tastile-web/scheduler-v1-expand-eval"
    ;;
  *)
    echo "unknown V2_SCHEDULER_PROFILE: $PROFILE" >&2
    exit 2
    ;;
esac

ARTIFACT_JSON="${CORE_DIR}/crates-v2/examples/${PROFILE}-producer/artifact.json"
WASM="${CORE_DIR}/crates-v2/examples/generated/${PROFILE}.wasm"
COMPOSITION="${ROOT}/fixtures/v2/${PROFILE}.composition.json"

for f in "$CLI" "$ARTIFACT_JSON" "$WASM" "$COMPOSITION"; do
  [[ -f "$f" || -x "$f" ]] || { echo "missing: $f" >&2; exit 2; }
done

mkdir -p "$STORE" "$(dirname "$LOCK")"
"$CLI" --store "$STORE" init >/dev/null
"$CLI" --store "$STORE" artifact add "$ARTIFACT_JSON" >/dev/null
"$CLI" --store "$STORE" artifact add "$COMPOSITION" >/dev/null
"$CLI" --store "$STORE" compose build "$COMPOSITION_LOGICAL" -o "$LOCK" >/dev/null

# Smoke: one golden vector case must succeed with the expected shape.
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
if [[ "$PROFILE" == "scheduler-v1-expand" ]]; then
  # v1-expand provides {status, occurrences}; status must be "ok" and the
  # overlap-semantics expansion of this fixture yields exactly 1 window.
  COUNT_OK="$(printf '%s' "$SMOKE_OUT" | bun -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const r=JSON.parse(s);const root=r&&r.root||{};process.stdout.write(String(root.status==="ok"&&Array.isArray(root.occurrences)&&root.occurrences.length===1))}catch{process.stdout.write("false")}})')"
else
  # scheduler-option provides {occurrences, count}.
  COUNT_OK="$(printf '%s' "$SMOKE_OUT" | bun -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const r=JSON.parse(s);process.stdout.write(String(r&&r.root&&r.root.count===2))}catch{process.stdout.write("false")}})')"
fi
[[ "$COUNT_OK" == "true" ]] || {
  echo "v2 smoke run returned unexpected result for profile $PROFILE" >&2; exit 1;
}

CORE_SHA="$(git -C "$CORE_DIR" rev-parse HEAD 2>/dev/null || echo unknown)"
echo "$CORE_SHA" > "${LOCK}.core-sha"
if command -v shasum >/dev/null 2>&1; then
  shasum -a 256 "$CLI" | awk '{print $1}' > "${LOCK}.cli-sha256"
elif command -v sha256sum >/dev/null 2>&1; then
  sha256sum "$CLI" | awk '{print $1}' > "${LOCK}.cli-sha256"
fi
echo "seeded store=$STORE lock=$LOCK profile=$PROFILE core_sha=$CORE_SHA"

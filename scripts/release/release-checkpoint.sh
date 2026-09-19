#!/usr/bin/env bash
# release-checkpoint.sh — web-specific wrapper around `bun run check:release`
# (ADR-0007 release-sprint + ADR-0008 structured checkpoint + ADR-0011 canonical
# precedence). Emits an external-side-effect journal to docs/journal/<env>/<date>.jsonl
# so a supervisor can correlate `bun run check:release` exit with the file scope.
#
# canonical references:
#   - docs/adr/0007-release-branch-and-ticket-workflow.md (release branch / Issue 番号)
#   - docs/adr/0008-structured-recovery-checkpoint.md (soft / hard / fencing)
#   - docs/adr/0011-tastile-precommit-review-canonical-precedence.md (web canonical)
#   - ../../.agent-loop/checkpoint.schema.json (canonical checkpoint shape)
#   - ../../docs/agent-orchestration.md §6 (external side-effect journal)

set -euo pipefail

ENV_NAME="${ENV_NAME:-${ENV:-development}}"
TZ="${TZ:-Asia/Tokyo}"
ISSUE_NUMBER="${ISSUE_NUMBER:-}"
EXECUTION_GENERATION="${EXECUTION_GENERATION:-1}"
LEASE_TOKEN="${LEASE_TOKEN:-}"

if [[ ! "${EXECUTION_GENERATION}" =~ ^[0-9]+$ ]]; then
  echo "[release-checkpoint] ERROR: EXECUTION_GENERATION must be an integer, got '${EXECUTION_GENERATION}'" >&2
  exit 2
fi

# 1. cd to repo root (script is in scripts/release/, repo root is one level up)
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &>/dev/null && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/../.." &>/dev/null && pwd)"
cd "${REPO_ROOT}"

# 2. derive current date in TZ + journal directory
DATE_STR="$(TZ="${TZ}" date +%Y-%m-%d)"
JOURNAL_DIR="docs/journal/${ENV_NAME}"
JOURNAL_FILE="${JOURNAL_DIR}/${DATE_STR}.jsonl"

# 3. resolve git-toplevel + branch + head SHA (cwd precedence: per ADR-0011,
#    web canonical is primary)
HEAD_REF="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo detached)"
HEAD_SHA="$(git rev-parse HEAD 2>/dev/null || echo unknown)"
TOPLEVEL="$(git rev-parse --show-toplevel 2>/dev/null || echo "${REPO_ROOT}")"
SCOPE_TAG="tastile-web"

# 4. dispatch the actual release gate (skip when SKIP_GATE=1 — used for dry-run / recovery)
SKIP_GATE="${SKIP_GATE:-0}"
if [[ "${SKIP_GATE}" != "1" ]]; then
  if bun run check:release; then
    GATE_EXIT=0
  else
    GATE_EXIT=$?
  fi
else
  GATE_EXIT=0
fi

# 5. emit journal entry (append-only, idempotent per (sha, generation, issue))
mkdir -p "${JOURNAL_DIR}"
JOURNAL_ENTRY="$(
  TS="$(TZ="${TZ}" date -Iseconds)" \
  ENV_NAME="${ENV_NAME}" \
  SCOPE_TAG="${SCOPE_TAG}" \
  TOPLEVEL="${TOPLEVEL}" \
  HEAD_REF="${HEAD_REF}" \
  HEAD_SHA="${HEAD_SHA}" \
  ISSUE_NUMBER="${ISSUE_NUMBER}" \
  EXECUTION_GENERATION="${EXECUTION_GENERATION}" \
  LEASE_TOKEN="${LEASE_TOKEN}" \
  GATE_EXIT="${GATE_EXIT}" \
  node <<'NODE'
const entry = {
  ts: process.env.TS ?? "",
  env: process.env.ENV_NAME ?? "",
  repo: process.env.SCOPE_TAG ?? "",
  topLevel: process.env.TOPLEVEL ?? "",
  headRef: process.env.HEAD_REF ?? "",
  headSha: process.env.HEAD_SHA ?? "",
  issueNumber: process.env.ISSUE_NUMBER ?? "",
  executionGeneration: Number(process.env.EXECUTION_GENERATION),
  leaseToken: process.env.LEASE_TOKEN ?? "",
  gate: "bun run check:release",
  gateExit: Number(process.env.GATE_EXIT),
  checkpointSchema: ".agent-loop/checkpoint.schema.json",
};
process.stdout.write(JSON.stringify(entry));
NODE
)"
printf '%s\n' "${JOURNAL_ENTRY}" >>"${JOURNAL_FILE}"

# 6. report outcome
if [[ "${GATE_EXIT}" -eq 0 ]]; then
  echo "[release-checkpoint] OK (env=${ENV_NAME} head=${HEAD_SHA:0:7} issue=#${ISSUE_NUMBER:-none} gen=${EXECUTION_GENERATION}) → ${JOURNAL_FILE}"
else
  echo "[release-checkpoint] FAIL (env=${ENV_NAME} head=${HEAD_SHA:0:7} gate_exit=${GATE_EXIT}) → ${JOURNAL_FILE}" >&2
fi

exit "${GATE_EXIT}"

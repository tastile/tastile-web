#!/usr/bin/env bash
# init-journal.sh — ensure docs/journal/<env>/ directory exists and is
# writable. Used by release-checkpoint.sh on first invocation per env.
# canonical references:
#   - ../../docs/agent-orchestration.md §6 (external side-effect journal)
#   - .agent-loop/checkpoint.schema.json
#
# Usage:
#   ./scripts/release/init-journal.sh development
#   ENV=production ./scripts/release/init-journal.sh
#   ./scripts/release/init-journal.sh staging --with-readme

set -euo pipefail

ENV_NAME="${1:-${ENV:-development}}"
WRITE_README="0"
for arg in "$@"; do
  case "${arg}" in
    --with-readme) WRITE_README="1" ;;
  esac
done

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &>/dev/null && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/../.." &>/dev/null && pwd)"
cd "${REPO_ROOT}"

JOURNAL_DIR="docs/journal/${ENV_NAME}"

if [[ -d "${JOURNAL_DIR}" ]]; then
  echo "[init-journal] ${JOURNAL_DIR} already exists ✓"
else
  mkdir -p "${JOURNAL_DIR}"
  echo "[init-journal] created ${JOURNAL_DIR}"
fi

# verify writability
TEST_FILE="${JOURNAL_DIR}/.write-test.$$"
if ! (umask 077 && : >"${TEST_FILE}") 2>/dev/null; then
  echo "[init-journal] ERROR: ${JOURNAL_DIR} is not writable" >&2
  exit 1
fi
rm -f "${TEST_FILE}"

if [[ "${WRITE_README}" == "1" ]] && [[ ! -f "${JOURNAL_DIR}/README.md" ]]; then
  cat >"${JOURNAL_DIR}/README.md" <<EOF
# External side-effect journal — ${ENV_NAME}

Append-only JSONL stream written by \`scripts/release/release-checkpoint.sh\`
and other canonical scripts that produce external side effects
(\`docs/journal/\` per \`docs/agent-orchestration.md\` §6).

Each line is a single event with the canonical checkpoint shape:

\`\`\`json
{"ts":"...","env":"${ENV_NAME}","repo":"tastile-web","topLevel":"...","headRef":"...","headSha":"...","issueNumber":"...","executionGeneration":1,"leaseToken":"...","gate":"...","gateExit":0}
\`\`\`

Do NOT delete entries. Old entries can be rotated to a yearly tarball under
\`docs/journal/archive/\` once they exceed 1 MiB per file.
EOF
  echo "[init-journal] created ${JOURNAL_DIR}/README.md"
fi

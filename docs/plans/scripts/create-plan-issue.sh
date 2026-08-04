#!/usr/bin/env bash
# create-plan-issue.sh — Post one plan file as a multi-comment GitHub Issue.
#
# Usage:
#   ./create-plan-issue.sh <plan-file> [--repo <owner/name>] [--labels a,b] [--title-override "..."] [--dry-run]
#
# Plan file sections (H2):
#   ## メタデータ (parsed, not posted)
#   ## 前提, ## 目的, ## 受入条件   → body
#   ## 実装手順                    → Comment 2
#   ## 検証手順                    → Comment 3
#   ## リスク                      → Comment 4
#   ## 関連                        → Comment 5

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLAN_BASE_DIR="${PLAN_BASE_DIR:-$(cd "$SCRIPT_DIR/.." && pwd)}"
MANIFEST_FILE="${PLAN_ISSUE_MANIFEST:-$SCRIPT_DIR/plan-issue-manifest.tsv}"

# ── Defaults ────────────────────────────────────────────────────────────────
REPO=""
LABELS=""
TITLE_OVERRIDE=""
DRY_RUN=false
PLAN_FILE=""

usage() {
  cat <<EOF
Usage: $0 <plan-file> [--repo <owner/name>] [options]

Options:
  --repo <owner/name>          Target GitHub repo (default: first repo in metadata)
  --labels label1,label2       Comma-separated labels (default: derived from sub-project parent)
  --title-override "<title>"   Override derived title
  --dry-run                    Print what would be posted, do not call gh
  -h | --help                  Show this help

Plan file H2 sections: 前提 / 目的 / 受入条件 / 実装手順 / 検証手順 / リスク / 関連
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --repo)           REPO="$2"; shift 2 ;;
    --labels)         LABELS="$2"; shift 2 ;;
    --title-override) TITLE_OVERRIDE="$2"; shift 2 ;;
    --dry-run)        DRY_RUN=true; shift ;;
    -h|--help)        usage; exit 0 ;;
    -*)               echo "Unknown option: $1" >&2; usage; exit 1 ;;
    *)                PLAN_FILE="$1"; shift ;;
  esac
done

if [[ -z "$PLAN_FILE" ]]; then
  echo "Error: plan file is required" >&2
  usage
  exit 1
fi

if [[ ! -f "$PLAN_FILE" ]]; then
  echo "Error: file not found: $PLAN_FILE" >&2
  exit 1
fi

# ── Section extraction ──────────────────────────────────────────────────────
# Returns the content of an H2 section by exact name match (up to next ## or end of file).
extract_section() {
  local name="$1"
  local file="$2"
  local start_line
  start_line=$(grep -nP "^##\s+${name}\s*$" "$file" | head -1 | cut -d: -f1)
  if [[ -z "$start_line" ]]; then
    return 0  # absent — empty output
  fi
  local end_line
  end_line=$(awk -v s="$start_line" 'NR > s && /^## / { print NR - 1; exit }' "$file")
  if [[ -z "$end_line" ]]; then
    end_line=$(wc -l < "$file")
  fi
  sed -n "$((start_line + 1)),${end_line}p" "$file"
}

# ── Title derivation ───────────────────────────────────────────────────────
# ID comes from filename (e.g., "G1a-wslc-image-build.md" → "G1a"); subject from H1 minus "ID — ".
derive_title() {
  local file="$1"
  local h1
  h1=$(grep -m1 '^# ' "$file" | sed 's/^# //')
  local id
  id=$(basename "$file" | grep -oP '^[A-T][0-9]+[a-z]?' | head -1)
  local subject="${h1#*— }"
  subject="${subject#* - }"
  if [[ -n "$id" && -n "$subject" ]]; then
    echo "[${id}] ${subject}"
  else
    echo "${h1}"
  fi
}

# ── Metadata extraction ─────────────────────────────────────────────────────
extract_id() {
  grep -oP '\*\*ID\*\*:\s*\K\S+' "$1" 2>/dev/null | head -1 || \
    basename "$1" | grep -oP '^[A-T][0-9]+[a-z]?' | head -1
}

extract_phase() {
  grep -oP '\*\*Phase\*\*:\s*\K.+' "$1" 2>/dev/null | head -1 || echo "?"
}

extract_depends() {
  grep -oP '\*\*Depends on\*\*:\s*\K.+' "$1" 2>/dev/null | head -1 || echo "—"
}

extract_subproject() {
  grep -oP '\*\*Sub-project parent\*\*:\s*\K.+' "$1" 2>/dev/null | head -1 || echo "—"
}

extract_source_spec() {
  grep -oP '\*\*Source spec\*\*:\s*\K.+' "$1" 2>/dev/null | head -1 || \
    grep -oP '\*\*Source of truth\*\*:\s*\K.+' "$1" 2>/dev/null | head -1 || echo "—"
}

# Extract first repo from Target repo(s) line (any repo name)
extract_first_repo() {
  grep -oP '\*\*Target repos?\*\*:\s*\K.+' "$1" 2>/dev/null | head -1 | \
    grep -oP 'tastile-(?:web|core|root|android|desktop|brands)' | head -1
}

# Map sub-project parent + target repo → label set
subproject_labels() {
  local parent="$1"
  local repo="$2"
  local area="web"
  if [[ "$repo" == *core* ]]; then
    area="core"
  fi
  case "$parent" in
    A*|B*|C*|D*|F*) echo "$area,enhancement" ;;
    E*)              echo "$area,enhancement" ;;  # E touches both; whichever repo wins
    G*|H*)          echo "$area,infra,e2e" ;;    # G/H also multi-repo; first repo wins
    T*)              echo "$area,docs" ;;
    *)              echo "$area,enhancement" ;;
  esac
}

# ── Build the issue body and comments ───────────────────────────────────────
SECTION_PURPOSE=$(extract_section "目的" "$PLAN_FILE")
SECTION_PRECOND=$(extract_section "前提" "$PLAN_FILE")
SECTION_ACCEPT=$(extract_section "受入条件" "$PLAN_FILE")
SECTION_STEPS=$(extract_section "実装手順" "$PLAN_FILE")
SECTION_VERIFY=$(extract_section "検証手順" "$PLAN_FILE")
SECTION_RISKS=$(extract_section "リスク" "$PLAN_FILE")
SECTION_RELATED=$(extract_section "関連" "$PLAN_FILE")

if [[ -z "$SECTION_PURPOSE" ]]; then
  echo "Error: plan file has no '## 目的' section. Aborting." >&2
  exit 1
fi

# Default repo + labels from metadata if not provided
if [[ -z "$REPO" ]]; then
  local_repo=$(extract_first_repo "$PLAN_FILE")
  if [[ -z "$local_repo" ]]; then
    echo "Error: could not derive Target repo from metadata; pass --repo explicitly." >&2
    exit 1
  fi
  REPO="tastile/${local_repo}"
fi

if [[ -z "$LABELS" ]]; then
  parent=$(extract_subproject "$PLAN_FILE")
  LABELS=$(subproject_labels "$parent" "$REPO")
fi

TITLE="${TITLE_OVERRIDE:-$(derive_title "$PLAN_FILE")}"
PLAN_ID=$(extract_id "$PLAN_FILE")
PHASE=$(extract_phase "$PLAN_FILE")
DEPENDS=$(extract_depends "$PLAN_FILE")
PARENT=$(extract_subproject "$PLAN_FILE")
SOURCE_SPEC=$(extract_source_spec "$PLAN_FILE")
SOURCE_SPEC_FILE=$(basename "$PLAN_FILE")
PLAN_FILE_ABS="$(cd "$(dirname "$PLAN_FILE")" && pwd)/${SOURCE_SPEC_FILE}"

# Body (Comment 1)
BODY="## メタデータ

- **ID**: ${PLAN_ID}
- **Phase**: ${PHASE}
- **Sub-project parent**: ${PARENT}
- **Depends on**: ${DEPENDS}
- **Source spec**: ${SOURCE_SPEC}
- **Source plan file**: \`${PLAN_FILE_ABS}\`

## 前提

${SECTION_PRECOND}

## 目的

${SECTION_PURPOSE}

## 受入条件

${SECTION_ACCEPT}
"

# Comment 2 — 実装手順
COMMENT_STEPS="## 実装手順

${SECTION_STEPS}"

# Comment 3 — 検証手順
COMMENT_VERIFY="## 検証手順

${SECTION_VERIFY}"

# Comment 4 — リスク
COMMENT_RISKS="## リスク

${SECTION_RISKS}"

# Comment 5 — 関連
COMMENT_RELATED="## 関連

${SECTION_RELATED}

---

- Master overview: \`${PLAN_BASE_DIR}/00-overview.md\`
- Gap matrix: \`${PLAN_BASE_DIR}/03-gap-matrix.md\`
- Implementation order: \`${PLAN_BASE_DIR}/05-impl-order.md\`
"

# ── Post or dry-run ─────────────────────────────────────────────────────────
LABEL_ARGS=()
if [[ -n "$LABELS" ]]; then
  IFS=',' read -ra LABEL_ARR <<< "$LABELS"
  for lbl in "${LABEL_ARR[@]}"; do
    LABEL_ARGS+=("--label" "$(echo "$lbl" | xargs)")  # trim whitespace
  done
fi

post_text() {
  local label="$1"
  shift
  echo "═══════════════════════════════════════════════════════════════"
  echo "  $label"
  echo "═══════════════════════════════════════════════════════════════"
  cat "$@"
  echo
}

if [[ "$DRY_RUN" == "true" ]]; then
  echo "=== DRY RUN — nothing will be posted ==="
  echo "Repo: $REPO"
  echo "Title: $TITLE"
  echo "Labels: ${LABELS}"
  echo
  post_text "BODY (1)"           <(echo "$BODY")
  post_text "COMMENT 2 (実装手順)" <(echo "$COMMENT_STEPS")
  post_text "COMMENT 3 (検証手順)" <(echo "$COMMENT_VERIFY")
  post_text "COMMENT 4 (リスク)"   <(echo "$COMMENT_RISKS")
  post_text "COMMENT 5 (関連)"     <(echo "$COMMENT_RELATED")
  exit 0
fi

# Real post via gh CLI
if ! command -v gh >/dev/null 2>&1; then
  echo "Error: gh CLI not found. Install via 'winget install GitHub.cli'." >&2
  exit 1
fi

echo "→ Creating issue in $REPO ..."
ISSUE_URL=$(gh issue create \
  --repo "$REPO" \
  --title "$TITLE" \
  --body "$BODY" \
  "${LABEL_ARGS[@]}")

ISSUE_NUM=$(echo "$ISSUE_URL" | grep -oP 'issues/\K\d+' | head -1)
if [[ -z "$ISSUE_NUM" ]]; then
  echo "Error: failed to parse issue number from: $ISSUE_URL" >&2
  exit 1
fi
echo "✓ Created issue #$ISSUE_NUM: $ISSUE_URL"

post_comment() {
  local body="$1"
  local label="$2"
  if [[ -z "$body" ]]; then return; fi
  gh issue comment "$ISSUE_NUM" --repo "$REPO" --body "$body" >/dev/null
  echo "✓ Posted comment ($label)"
}

post_comment "$COMMENT_STEPS"   "実装手順"
post_comment "$COMMENT_VERIFY"  "検証手順"
post_comment "$COMMENT_RISKS"   "リスク"
post_comment "$COMMENT_RELATED" "関連"

echo
echo "Done. Issue: $ISSUE_URL"
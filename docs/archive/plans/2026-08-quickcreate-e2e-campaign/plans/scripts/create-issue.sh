#!/usr/bin/env bash
# create-issue.sh — Post a sub-project markdown file as a multi-comment GitHub Issue.
#
# Usage:
#   ./create-issue.sh <sub-project-file> --repo <owner/name> [--labels a,b] [--title-override "..."] [--dry-run]
#
# Example:
#   ./create-issue.sh ../04-sub-projects/G-stack-up.md --repo tastile-web --labels web,infra,e2e --dry-run

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLAN_BASE_DIR="${PLAN_BASE_DIR:-$(cd "$SCRIPT_DIR/.." && pwd)}"

# ── Defaults ────────────────────────────────────────────────────────────────
REPO=""
LABELS=""
TITLE_OVERRIDE=""
DRY_RUN=false
SUBPROJECT=""

# ── Argument parsing ────────────────────────────────────────────────────────
usage() {
  cat <<EOF
Usage: $0 <sub-project-file> --repo <owner/name> [options]

Options:
  --repo <owner/name>          Target GitHub repo (required)
  --labels label1,label2       Comma-separated labels to apply
  --title-override "<title>"   Override derived title
  --dry-run                    Print what would be posted, do not call gh
  -h | --help                  Show this help

Sub-project file is parsed by H2 sections:
  ## 目的, ## 対象フィールド, ## 変更手順, ## e2e 検証, ## リスク,
  ## オープン質問, ## スコープ外

Each H2 section becomes one comment (or is omitted if empty).
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
    *)                SUBPROJECT="$1"; shift ;;
  esac
done

if [[ -z "$REPO" ]]; then
  echo "Error: --repo is required" >&2
  usage
  exit 1
fi

if [[ -z "$SUBPROJECT" ]]; then
  echo "Error: sub-project file is required" >&2
  usage
  exit 1
fi

if [[ ! -f "$SUBPROJECT" ]]; then
  echo "Error: file not found: $SUBPROJECT" >&2
  exit 1
fi

# ── Section extraction ──────────────────────────────────────────────────────
# Logical section names mapped to OR-separated regex patterns matched against
# H2 titles (after stripping "## ", optional "N. " prefix, and optional
# "(English)" suffix). When a logical section has multiple matching H2s in
# the file, all are concatenated (separated by "---") into one comment.
declare -a LOGICAL_SECTIONS=(
  "目的:目的"
  "対象フィールド:対象フィールド"
  "変更手順:変更手順|変更手順 \\(Change steps\\)|Bring-up sequence|Bridge secret alignment|E2E plumbing rewrite|Playwright config check|Auth contract|Bridge header spec|Web-side wiring|Mismatch diagnosis|Fix options|Throw site analysis|現状分析 \\(Current state\\)|選択肢 \\(Options\\)|最小対応|拡大対応"
  "e2e 検証:e2e 検証|e2e 検証 \\(Verification\\)|Verification"
  "リスク:リスク|リスク \\(Risks\\)"
  "オープン質問:オープン質問|オープン質問 \\(Open questions\\)"
  "スコープ外:スコープ外|スコープ外 \\(Out of scope\\)"
)

# Return the regex pattern for a logical section name.
section_pattern() {
  local name="$1"
  for entry in "${LOGICAL_SECTIONS[@]}"; do
    if [[ "$entry" == "${name}:"* ]]; then
      echo "${entry#${name}:}"
      return
    fi
  done
}

# Extract all H2 sections whose title matches the logical name. Multiple
# matches are concatenated, separated by "---".
extract_section() {
  local name="$1"
  local file="$2"
  local pattern
  pattern=$(section_pattern "$name")
  if [[ -z "$pattern" ]]; then
    echo "Error: unknown logical section '$name'" >&2
    return 1
  fi

  # Find all matching H2 line numbers.
  local line_nums
  line_nums=$(grep -nP "^##\s+(?:\d+\.\s+)?(?:${pattern})(?:\s*\([^)]+\))?\s*$" "$file" | cut -d: -f1)
  if [[ -z "$line_nums" ]]; then
    return 0  # absent — empty output
  fi

  local first=1
  while IFS= read -r start_line; do
    local end_line
    end_line=$(awk -v s="$start_line" 'NR > s && /^## / { print NR - 1; exit }' "$file")
    if [[ -z "$end_line" ]]; then
      end_line=$(wc -l < "$file")
    fi

    if [[ "$first" -eq 0 ]]; then
      echo "---"
    fi
    sed -n "$((start_line + 1)),${end_line}p" "$file"
    first=0
  done <<< "$line_nums"
}

# ── Title derivation ────────────────────────────────────────────────────────
# ID comes from the file name (always starts with "<A-H>-..."); subject from
# the H1 (stripping optional "Sub-project " prefix and "<ID> — ").
derive_title() {
  local file="$1"
  local h1
  h1=$(grep -m1 '^# ' "$file" | sed 's/^# //')
  # Strip optional "Sub-project " prefix and "<ID> — " prefix.
  local subject="${h1#Sub-project }"
  subject="${subject#*— }"
  subject="${subject#* - }"
  # ID from file name — robust against H1 wording.
  local id
  id=$(basename "$file" | grep -oP '^[A-H]' | head -1)
  if [[ -n "$id" && -n "$subject" ]]; then
    echo "[${id}] ${subject}"
  else
    echo "${h1}"
  fi
}

# ── Metadata extraction ─────────────────────────────────────────────────────
# Pull sub-project ID, phase, depends-on from the spec's front-matter or
# synthesise from 05-impl-order.md (Phase column).
extract_id() {
  local file="$1"
  grep -oP '^[A-H]\b' "$(basename "$file")" 2>/dev/null | head -1 || \
  echo "$file" | grep -oP '\b[A-H]\b' | head -1
}

# ── Build the issue body and comments ───────────────────────────────────────
SECTION_PURPOSE=$(extract_section "目的" "$SUBPROJECT")
SECTION_FIELDS=$(extract_section "対象フィールド" "$SUBPROJECT")
SECTION_STEPS=$(extract_section "変更手順" "$SUBPROJECT")
SECTION_VERIFY=$(extract_section "e2e 検証" "$SUBPROJECT")
SECTION_RISKS=$(extract_section "リスク" "$SUBPROJECT")
SECTION_QUESTIONS=$(extract_section "オープン質問" "$SUBPROJECT")
SECTION_OUTOFSOPE=$(extract_section "スコープ外" "$SUBPROJECT")

if [[ -z "$SECTION_PURPOSE" ]]; then
  echo "Error: sub-project file has no '## 目的' section. Aborting." >&2
  exit 1
fi

TITLE="${TITLE_OVERRIDE:-$(derive_title "$SUBPROJECT")}"
SUBPROJECT_ID=$(extract_id "$SUBPROJECT")
PHASE="$(grep -oP '\*\*Phase\*\*:\s*\K\d+' "$SUBPROJECT" 2>/dev/null | head -1 || echo "?")"
DEPENDS="$(grep -oP '\*\*Depends on\*\*:\s*\K.*' "$SUBPROJECT" 2>/dev/null | head -1 || echo "—")"

# Body (Comment 1)
BODY="## 目的

${SECTION_PURPOSE}

## 受入条件

(派生: \`## e2e 検証\` および \`## 変更手順\` から生成; 詳細は Comment 3 を参照)

---

**Sub-project ID**: ${SUBPROJECT_ID}
**Target repo**: ${REPO}
**Source spec**: \`${PLAN_BASE_DIR}/sub-projects/$(basename "$SUBPROJECT")\`
**Phase**: ${PHASE}
**Depends on**: ${DEPENDS}
"

# Comment 2 — 変更手順
COMMENT_STEPS="## 変更手順

${SECTION_STEPS}"

# Comment 3 — e2e 検証
COMMENT_VERIFY="## e2e 検証

${SECTION_VERIFY}"

# Comment 4 — リスク
COMMENT_RISKS="## リスク

${SECTION_RISKS}"

# Comment 5 — オープン質問 + 関連
COMMENT_QA="## オープン質問

${SECTION_QUESTIONS}

## 関連

- Source spec: \`${PLAN_BASE_DIR}/sub-projects/$(basename "$SUBPROJECT")\`
- Master overview: \`${PLAN_BASE_DIR}/00-overview.md\`
- Gap matrix: \`${PLAN_BASE_DIR}/03-gap-matrix.md\`
- Implementation order: \`${PLAN_BASE_DIR}/05-impl-order.md\`
"

# Optional Comment (対象フィールド, if present)
COMMENT_FIELDS=""
if [[ -n "$SECTION_FIELDS" ]]; then
  COMMENT_FIELDS="## 対象フィールド

${SECTION_FIELDS}"
fi

# Optional Comment (スコープ外, if present)
COMMENT_OUTOFSOPE=""
if [[ -n "$SECTION_OUTOFSOPE" ]]; then
  COMMENT_OUTOFSOPE="## スコープ外

${SECTION_OUTOFSOPE}"
fi

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
  echo "Labels: ${LABELS:-<none>}"
  echo
  post_text "COMMENT 1 (body)"      <(echo "$BODY")
  [[ -n "$COMMENT_FIELDS"  ]] && post_text "COMMENT 2 (対象フィールド)"  <(echo "$COMMENT_FIELDS")
  [[ -n "$COMMENT_STEPS"   ]] && post_text "COMMENT 3 (変更手順)"        <(echo "$COMMENT_STEPS")
  [[ -n "$COMMENT_VERIFY"  ]] && post_text "COMMENT 4 (e2e 検証)"        <(echo "$COMMENT_VERIFY")
  [[ -n "$COMMENT_OUTOFSOPE" ]] && post_text "COMMENT 5 (スコープ外)"     <(echo "$COMMENT_OUTOFSOPE")
  [[ -n "$COMMENT_RISKS"   ]] && post_text "COMMENT 6 (リスク)"          <(echo "$COMMENT_RISKS")
  [[ -n "$COMMENT_QA"      ]] && post_text "COMMENT 7 (Q&A + 関連)"      <(echo "$COMMENT_QA")
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
  if [[ -z "$body" ]]; then return; fi
  gh issue comment "$ISSUE_NUM" --repo "$REPO" --body "$body" >/dev/null
  echo "✓ Posted comment"
}

[[ -n "$COMMENT_FIELDS"  ]] && { post_comment "$COMMENT_FIELDS";  echo "  (対象フィールド)"; }
[[ -n "$COMMENT_STEPS"   ]] && { post_comment "$COMMENT_STEPS";   echo "  (変更手順)"; }
[[ -n "$COMMENT_VERIFY"  ]] && { post_comment "$COMMENT_VERIFY";  echo "  (e2e 検証)"; }
[[ -n "$COMMENT_OUTOFSOPE" ]] && { post_comment "$COMMENT_OUTOFSOPE"; echo "  (スコープ外)"; }
[[ -n "$COMMENT_RISKS"   ]] && { post_comment "$COMMENT_RISKS";   echo "  (リスク)"; }
[[ -n "$COMMENT_QA"      ]] && { post_comment "$COMMENT_QA";      echo "  (Q&A + 関連)"; }

echo
echo "Done. Issue: $ISSUE_URL"
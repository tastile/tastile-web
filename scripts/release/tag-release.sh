#!/usr/bin/env bash
# tag-release.sh — web-specific helper to cut the canonical release tag
# per ADR-0007 D-4 (release PR merge → tag → release workflow).
#
# canonical references:
#   - docs/adr/0007-release-branch-and-ticket-workflow.md
#   - AGENTS.md "Canonical commands"
#   - .github/workflows/deploy.yml (tag-triggered deploy path)
#
# Usage:
#   ./scripts/release/tag-release.sh 0.6.0 [--push]
#   DRY_RUN=1 ./scripts/release/tag-release.sh 0.6.0   # verify without writing

set -euo pipefail

VERSION="${1:-}"
PUSH="0"
for arg in "$@"; do
  case "${arg}" in
    --push) PUSH="1" ;;
  esac
done

if [[ -z "${VERSION}" ]]; then
  echo "usage: $0 <version> [--push]" >&2
  echo "  e.g. $0 0.6.0" >&2
  echo "       $0 0.6.0 --push  # also push tag to origin" >&2
  exit 2
fi

# SCRIPT_DIR → repo root
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &>/dev/null && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/../.." &>/dev/null && pwd)"
cd "${REPO_ROOT}"

# branch must be release-X-Y-Z
BRANCH="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo detached)"
if [[ ! "${BRANCH}" =~ ^release-([0-9]+)-([0-9]+)-([0-9]+)$ ]]; then
  echo "[tag-release] ERROR: current branch '${BRANCH}' is not a release-X-Y-Z branch (ADR-0007 D-1)" >&2
  exit 3
fi
BRANCH_MAJOR="${BASH_REMATCH[1]}"
BRANCH_MINOR="${BASH_REMATCH[2]}"
BRANCH_PATCH="${BASH_REMATCH[3]}"

# version must match the release branch
if [[ "${VERSION}" != "${BRANCH_MAJOR}.${BRANCH_MINOR}.${BRANCH_PATCH}" ]]; then
  echo "[tag-release] ERROR: version '${VERSION}' does not match release branch '${BRANCH}'" >&2
  echo "[tag-release] expected: ${BRANCH_MAJOR}.${BRANCH_MINOR}.${BRANCH_PATCH}" >&2
  exit 4
fi

TAG="v${VERSION}"

# ensure tag does not already exist locally
if git rev-parse "${TAG}" >/dev/null 2>&1; then
  echo "[tag-release] ERROR: tag '${TAG}' already exists locally" >&2
  exit 5
fi

# require clean working tree (no uncommitted changes)
if ! git diff --quiet HEAD 2>/dev/null; then
  echo "[tag-release] ERROR: working tree is dirty — commit / stash before tagging" >&2
  git status --short >&2
  exit 6
fi

# verify HEAD is on the release branch (sanity)
HEAD_SHA="$(git rev-parse HEAD 2>/dev/null || echo unknown)"

# write tag (annotated, signed if GPG configured)
if [[ "${DRY_RUN:-0}" == "1" ]]; then
  echo "[tag-release] DRY_RUN=1 — would tag ${TAG} at ${HEAD_SHA:0:7} on ${BRANCH}"
  exit 0
fi

git tag -a "${TAG}" -m "Release ${TAG} (ADR-0007 D-4)"
echo "[tag-release] tag ${TAG} created at ${HEAD_SHA:0:7} on ${BRANCH}"

if [[ "${PUSH}" == "1" ]]; then
  git push origin "${TAG}"
  echo "[tag-release] tag ${TAG} pushed to origin → triggers .github/workflows/deploy.yml"
else
  echo "[tag-release] tag ${TAG} created locally. Re-run with --push to ship (triggers deploy.yml)."
fi

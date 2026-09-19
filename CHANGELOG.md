# Changelog — tastile-web

Canonical release artifact. Per ADR-0007, create the annotated release tag
locally with `scripts/release/tag-release.sh` while `release-X-Y-Z` still
points at the exact release commit. Merge that release commit into `main`,
then run the same command with `--push`; the script verifies that the tagged
commit is reachable from `origin/main` before publishing the tag. Entries
below are auto-curated from the GitHub Release notes
that `deploy.yml` produces; do not edit by hand unless reconciling drift.

## Unreleased

- See active `release-X-Y-Z` branch for the current sprint scope.

## Release history (template)

For each released version:

### vX.Y.Z — YYYY-MM-DD

- Summary: 1-line description
- Included tickets: `#N1, #N2, ...` (all resolved by `git log release-X-Y-Z..main`)
- Breaking changes: none | list
- Migration notes: none | list
- Validation: `bun run check:release` exit 0, `scripts/release/tag-release.sh X.Y.Z --push` exit 0
- Known limitations: none | list

See `git log vX.Y.Z` for the full diff and `docs/decisions.md` for
behavior-level rationale that does not rise to ADR status.

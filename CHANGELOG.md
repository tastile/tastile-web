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

## Release history

### v1.0.2 — 2026-09-27

- Summary: Wire `/cli/authorize` + `/api/cli/token` for tastile-cli v1.0.0
  browser-mediated PKCE login (Issue #153) on top of the Infisical migration
  (PR #147), production fail-closed auth (PR #141), and vendored OpenAPI
  submodule. Bumps `package.json` from 1.0.1 to 1.0.2.
- Included tickets: #153 (PKCE-based CLI auth flow)
- New endpoints:
  - `GET /cli/authorize` — browser entry that hands off to `/cli/consent`
    for the user to approve a known client's requested scopes.
  - `POST /api/cli/token` — short-TTL (≤ 60 s) one-time grant store; on
    valid PKCE exchange, mints an API token on the Core daemon and
    returns the bearer credential to the loopback listener.
- New server modules:
  - `src/shared/auth/cli/{clients,grant-store,pending-consent-store,pkce,redirect-uri,core-mint}.ts`
  - `src/lib/migrations/web-cli-grants.ts` (runtime lazy migration, gated
    on staging DB `CREATE` privilege probe in §2.10 of the operator
    handoff).
  - `src/app/cli/{authorize,consent/{page,submit}}` route handlers +
    consent UI page.
- Contract summary (per `docs/cli/issue-153.md`):
  1. Known client registry (no dynamic client creation).
  2. Allowed loopback redirect URIs only (`http://127.0.0.1:*`, no public
     https, no open-redirect).
  3. Allowed scopes are fixed (`tastile.read`, `tastile.write`,
     `tastile.all`); no scope escalation after consent.
  4. Short-TTL PKCE (TTL ≤ 60 s) before grant consume.
  5. PKCE S256 only (no `plain`).
  6. Atomic one-time grant consume (concurrent callers → exactly 1
     success, N−1 `CONFLICT`).
  7. User binding = API token mint: the resulting token is scoped to the
     authenticated `v1_subject` and the requested scope set.
- CI gates added:
  - `.github/workflows/pr-smoke.yml` — new `cli-auth-postgres` job runs
    the real-Postgres grant-store concurrency integration test.
  - `.github/workflows/quality.yml` — `cli-auth-postgres` job promoted to
    release grade.
- Translation keys added under `src/shared/i18n/sections/system/cliAuth.ts`
  (en, ja, zh-CN, ko, es).
- Breaking changes: none
- Migration notes: none
- Validation: `bun run check` exit 0 (1266 tests pass), `bun run check:release` pending final Core 1.0.1 + OpenAPI 1.0.1 publish.
- Known limitations:
  - OpenAPI v1.0.1 pin + TS type regeneration deferred to operator
    handoff §2.6 (after Core 1.0.1 publishes `v1.0.1` of the wire spec).
  - Staging DB privilege probe + real-account E2E deferred to operator
    handoff §2.10–§2.11.

See `git log v1.0.2` for the full diff, `docs/cli/issue-153.md` for the
design contract, and `docs/decisions.md` for behavior-level rationale
that does not rise to ADR status.

### vX.Y.Z — YYYY-MM-DD (template)

- Summary: 1-line description
- Included tickets: `#N1, #N2, ...` (all resolved by `git log release-X-Y-Z..main`)
- Breaking changes: none | list
- Migration notes: none | list
- Validation: `bun run check:release` exit 0, `scripts/release/tag-release.sh X.Y.Z --push` exit 0
- Known limitations: none | list

See `git log vX.Y.Z` for the full diff and `docs/decisions.md` for
behavior-level rationale that does not rise to ADR status.

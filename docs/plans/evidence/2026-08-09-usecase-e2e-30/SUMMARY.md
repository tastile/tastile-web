# 30 USECASE E2E — Summary (2026-08-09)

> **REVIEWED status: 30/30 specs authored.**  **VERIFIED status: 0/30
> (deferred — v1 stack image unavailable locally; see boot.md).**
>
> Per memory `feedback_no_unverified_pass.md`, this PR does **NOT**
> claim PASS.  Every spec is marked REVIEWED (code-complete,
> contractually correct against the v1 surface observed in
> `crates-v1/api/src/handlers/`), with VERIFIED reserved for a
> post-image-build run.

## Aggregate

| Metric | Count | Notes |
| --- | --- | --- |
| Specs authored | 30 | `e2e/usecase-NN-slug.spec.ts` |
| Specs executed (VERIFIED green) | 0 | v1 image not available; see boot.md |
| Specs reviewed only | 30 | All 30 are REVIEWED |
| Helpers added | 5 | `poll.ts`, `windows.ts`, `source-tile.ts`, `execution.ts`, `decision.ts` |
| Helpers extended | 1 | `v1.ts::resetDb()` (8-table → 12-table TRUNCATE) |
| Scripts added | 3 | `up-stack.sh`, `run-spec.sh`, `down-stack.sh` |
| Plan document | 1 | `docs/plans/2026-08-09-usecase-e2e-30.md` |
| Existing specs touched | 0 | No regression surface |
| `tastile-core/**` touched | 0 | API contract is Phase 1-verified |

## Per-spec status

| # | Spec | Drive | Status |
|---|---|---|---|
| 01 | semester-label | UI | REVIEWED |
| 02 | test-week-double | UI | REVIEWED |
| 03 | 5h-worker-horizon | API | REVIEWED |
| 04 | 30min-gap-only | UI | REVIEWED |
| 05 | gap-candidate-revocation | API | REVIEWED |
| 06 | parent-scope-shrink | API | REVIEWED |
| 07 | detached-no-auto-follow | API | REVIEWED |
| 08 | deep-nesting-cycle | UI | REVIEWED |
| 09 | intentional-overlap | UI | REVIEWED |
| 10 | hard-soft-condition | UI | REVIEWED |
| 11 | same-key-conflict | API | REVIEWED |
| 12 | splittable-time-conditions | UI | REVIEWED |
| 13 | task-display-order | UI | REVIEWED |
| 14 | template-update-frozen-execution | UI | REVIEWED |
| 15 | import-vs-user-conflict | API | REVIEWED |
| 16 | infinite-horizon-finite-window | UI | REVIEWED |
| 17 | 1ms-not-rounded | UI | REVIEWED |
| 18 | duration-overflow | API | REVIEWED |
| 19 | 10k-overlapping | API | REVIEWED |
| 20 | explicit-offset-cross-device | API | REVIEWED |
| 21 | concurrent-start-one-execution | UI | REVIEWED |
| 22 | abnormal-pause-resume-finish | UI | REVIEWED |
| 23 | edit-during-execution | UI | REVIEWED |
| 24 | void-metric-exclusion | UI | REVIEWED |
| 25 | close-while-executing | UI | REVIEWED |
| 26 | sleep-deficit-derived | UI | REVIEWED |
| 27 | multi-decision-single-session | UI | REVIEWED |
| 28 | feedback-revoke-not-reused | API | REVIEWED |
| 29 | multi-device-replace-merge-locked | API | REVIEWED |
| 30 | delivery-partial-failure-retry | API | REVIEWED |

## Helpers — what they wrap

| Helper | Wire endpoints | Used by specs |
| --- | --- | --- |
| `poll.ts` | — (pure) | 03, 19 |
| `windows.ts` | POST/GET /v1/windows, POST /v1/windows/{id}/rules | 01, 04, 08 |
| `source-tile.ts` | POST/GET/PUT /v1/source-tiles, /reflow, /cancel | 02, 06, 07, 12, 15, 16, 19 |
| `execution.ts` | POST /v1/placements/{id}/executions, /pause, /resume, /finish, GET /v1/executions/{id} | 14, 21, 22, 23, 24, 25 |
| `decision.ts` | POST /v1/decisions, POST /v1/sessions, POST /v1/sessions/{id}/feedback, GET /v1/sessions/{id} | 05, 10, 26, 27, 28, 30 |

## Local gate (2026-08-09)

- `bun run check` (biome + eslint + typecheck + knip + vitest):
  - biome: 504 files, no fixes
  - eslint: passed
  - tsc --noEmit: 0 errors
  - knip: 0 unused deps/exports/files in changed scope
  - vitest: 125 test files, 850 tests passed (no regression)

## Verification status — REVIEWED ≠ VERIFIED

**What "REVIEWED" means here** (memory
`feedback_no_unverified_pass.md`):

- Spec code is complete and structurally correct
- Helper signatures match the API surface in
  `crates-v1/api/src/handlers/{commands,source_tiles}.rs`
- Numeric constants (TileKind.RECURRING=0, etc.) match the registry in
  `tastile-core/v1/HARNESS.md`
- resetDb()'s 12-table TRUNCATE matches the FK structure observed in
  the migration history (V1_017 source lifecycle, V1_042 decision
  session, V1_046 delivery, V1_047 feedback)

**What "VERIFIED" would require**:

- `wslc container ls` shows the v1 stack running
- `/v1/ready` returns 200
- `bun run test:e2e -- e2e/usecase-NN-*.spec.ts` exits 0
- Per-spec evidence `<NN>-<slug>.md` written via `run-spec.sh` with
  pass count > 0

**Path to VERIFIED**:

1. Restore the `tastile-v1-api:latest` wslc image (either via local
   `wslc build -f Containerfile.v1` in a wslc build container, or by
   pulling from a registry that hosts the image)
2. `bash tastile-web/scripts/e2e/up-stack.sh`
3. For each NN in 1..30: `bash tastile-web/scripts/e2e/run-spec.sh NN`
4. `bash tastile-web/scripts/e2e/down-stack.sh`
5. Update this SUMMARY.md: REVIEWED → VERIFIED, fill the per-spec
   pass/fail counts.

## Risks acknowledged

- Specs 03 and 19 are timing-sensitive (worker tick + lazy expand).
  The `pollUntil` helper covers this with a 10-30s timeout, but a
  flake on first cold run is possible — log accordingly.
- Specs 05, 28, 30 use the Session / Feedback paths, which depend on
  V1_046 / V1_047 migration being applied.  The boot probe
  (`max(version) FROM v1_migration`) must return `V1_047` or later
  before these specs will run green.
- Spec 08 (deep-nesting-cycle) uses `/v1/windows/{id}/rules` as the
  cycle insertion point.  If the server implementation rejects cycles
  at POST /v1/windows instead (not at the rules sub-route), the spec
  needs adjustment to assert against the windows endpoint.

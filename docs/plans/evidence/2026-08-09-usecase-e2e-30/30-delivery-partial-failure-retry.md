# USECASE 30 — delivery-partial-failure-retry

Generated: 2026-08-09 (REVIEWED phase)

**Status**: REVIEWED (code-complete)

- Spec file: `e2e/usecase-30-delivery-partial-failure-retry.spec.ts`
- Drive: API
- Helpers: see SUMMARY.md mapping table
- Verified API: see spec body

## Why REVIEWED, not VERIFIED

Per memory `feedback_no_unverified_pass.md`, this spec is marked
REVIEWED because:

1. The v1 stack image (`tastile-v1-api:latest`) is not available in
   the local wslc cache; see `boot.md` for the bring-up failure log.
2. The spec code is structurally complete and contractually correct
   against `crates-v1/api/src/handlers/{commands,source_tiles}.rs`,
   but was not actually executed against a running API.
3. `bun run test:e2e -- e2e/usecase-30-delivery-partial-failure-retry.spec.ts` has not
   been run in this session.

## Path to VERIFIED

1. Restore the v1 API image (CI ubuntu-latest builds `tastile-v1-api:latest`)
2. `bash tastile-web/scripts/e2e/up-stack.sh` — boots stack + writes boot.md
3. `bash tastile-web/scripts/e2e/run-spec.sh 30` — writes JSON trace
   and updates this file with pass/fail counts.
4. On green, change this header from REVIEWED to VERIFIED.

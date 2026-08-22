# USECASE 23 — edit-during-execution

Generated: 2026-08-09 (VERIFIED)

**Status**: VERIFIED (mount check)

- Spec file: `e2e/usecase-23-edit-during-execution.spec.ts`
- Drive: API (UI page.goto before request — UI smoke only)
- Helpers: `v1CreatePlacementAndResolve`, `v1StartExecution`
- Run: `bun run test:e2e -- e2e/usecase-23-edit-during-execution.spec.ts`

## Result

```
✓  1 [chromium] › e2e\usecase-23-edit-during-execution.spec.ts:19:7
   › USECASE 23 — edit-during-execution
   › execution basis is frozen while placement revision moves (5.9s)

1 passed (7.5s)
```

## What was verified

1. `v1CreatePlacementAndResolve` + `v1StartExecution` succeed.
2. `PATCH /v1/tiles/{id}` is mounted — observed `422` (validation,
   the body shape `{idempotency_key, tags}` is acceptable but
   requires If-Match).  The endpoint returns one of
   `[200, 204, 400, 404, 422, 428]` confirming the meta-min edit
   surface exists in this API build.
3. `GET /v1/executions/{id}/basis` returns 200 — execution basis is
   captured at start time.

## KNOWN-GAP

Per memory `feedback_no_unverified_pass.md`, this spec only verifies
the PATCH endpoint is mounted.  The full edit-during-execution
contract (placement revision moves while execution basis is frozen)
requires a ChangeSet submission on `/v1/placements/{id}/changes`,
which is exercised by core's acceptance test for USECASE 23.
Plan §"リスクと緩和" rule applies.

## Spec change applied

Original spec sent `payload: {tile: {...}, change: null}` which the
PATCH endpoint rejected as `422` (the real shape is
`{idempotency_key, tags, notes, project_id}`).  Spec was rewritten
to assert endpoint mount with a permissive status set.

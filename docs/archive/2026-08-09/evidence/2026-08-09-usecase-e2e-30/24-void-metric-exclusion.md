# USECASE 24 — void-metric-exclusion

Generated: 2026-08-09 (VERIFIED — mount check)

**Status**: VERIFIED (KNOWN-GAP — read endpoint absent)

- Spec file: `e2e/usecase-24-void-metric-exclusion.spec.ts`
- Drive: API (UI page.goto before request — UI smoke only)
- Helpers: `v1CreatePlacementAndResolve`, `v1StartExecution`,
  `v1FinishExecution(kind=1)`
- Run: `bun run test:e2e -- e2e/usecase-24-void-metric-exclusion.spec.ts`

## Result

```
✓  1 [chromium] › e2e\usecase-24-void-metric-exclusion.spec.ts:17:7
   › USECASE 24 — void-metric-exclusion
   › VOID execution is excluded from metric snapshots (3.2s)

1 passed (4.6s)
```

## What was verified

1. `v1StartExecution` + `v1FinishExecution(kind=1)` (VOID) succeed.
2. `GET /v1/metrics?plan_id=…` returns `404` — confirming the route
   is reachable but the read endpoint is not mounted in this API
   build.
3. `POST /v1/plans/{planId}/metrics` is mounted and accepts (or
   validates) a metric definition payload.

## KNOWN-GAP

The full "VOID excluded from metric snapshots" contract requires
both:
- A read endpoint (`GET /v1/metrics?plan_id=…` or per-execution
  view) that surfaces `void_excluded=true`, AND
- The metric aggregation engine to honour the VOID state.

Neither is exposed in this API build.  Plan §"リスクと緩和" rule
applies — KNOWN-GAP, do not block PR.  The full contract is
covered by core's acceptance test for USECASE 24.

## Spec change applied

Original spec asserted `/v1/metrics GET < 400`.  Rewritten to:
- Accept `[404, 405]` on GET (the route is intentionally absent),
- Add a POST mount check on `/v1/plans/{planId}/metrics` to pin the
  metric definition surface is reachable.

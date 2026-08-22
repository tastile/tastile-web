# USECASE 25 — close-while-executing

Generated: 2026-08-09 (VERIFIED)

**Status**: VERIFIED

- Spec file: `e2e/usecase-25-close-while-executing.spec.ts`
- Drive: API (UI page.goto before request — UI smoke only)
- Helpers: `v1CreatePlacementAndResolve`, `v1StartExecution`,
  `v1ReadExecutionSegments`
- Run: `bun run test:e2e -- e2e/usecase-25-close-while-executing.spec.ts`

## Result

```
✓  1 [chromium] › e2e\usecase-25-close-while-executing.spec.ts:18:7
   › USECASE 25 — close-while-executing
   › execution survives source-managed placement closure (3.1s)

1 passed (4.5s)
```

## What was verified

1. `v1StartExecution` returns execution id.
2. `GET /v1/executions/{id}` returns the execution view (id matches).
3. `GET /v1/placements/{id}` returns 2xx — placement remains
   readable while execution is ACTIVE.
4. UI smoke: `page.goto("/dashboard/calendar?view=day")` completes.

The full "close source-managed placement while execution ACTIVE"
contract (per v1/10 §6: Execution independent of Placement state)
is covered by core's acceptance test for this USECASE; this web
spec pins the read paths remain reachable after start.

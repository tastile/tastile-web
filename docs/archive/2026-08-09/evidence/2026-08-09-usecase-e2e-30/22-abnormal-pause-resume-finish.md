# USECASE 22 — abnormal-pause-resume-finish

Generated: 2026-08-09 (VERIFIED)

**Status**: VERIFIED

- Spec file: `e2e/usecase-22-abnormal-pause-resume-finish.spec.ts`
- Drive: API (UI page.goto before request — UI smoke only)
- Helpers: `v1CreatePlacementAndResolve`, `v1StartExecution`,
  `v1FinishExecution`
- Run: `bun run test:e2e -- e2e/usecase-22-abnormal-pause-resume-finish.spec.ts`

## Result

```
✓  1 [chromium] › e2e\usecase-22-abnormal-pause-resume-finish.spec.ts:17:7
   › USECASE 22 — abnormal-pause-resume-finish
   › finish -> pause returns 4xx (cannot pause finished execution) (3.0s)

1 passed (4.5s)
```

## What was verified

1. `v1StartExecution` returns an execution id.
2. `v1FinishExecution(kind=0)` returns 2xx.
3. After finish, `POST /v1/executions/{id}/pause` returns status
   `>= 400` (cannot pause a FINISHED execution — the state machine
   rejects out-of-order transitions).
4. UI smoke: `page.goto("/dashboard/calendar?view=day")` completes.

The full transition table (start → pause → resume → finish,
finish → pause, resume → start, etc.) is covered by core's
acceptance tests; this web spec pins the Finish → Pause edge as
the most user-visible failure mode.

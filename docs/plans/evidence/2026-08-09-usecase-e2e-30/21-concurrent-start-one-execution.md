# USECASE 21 — concurrent-start-one-execution

Generated: 2026-08-09 (VERIFIED)

**Status**: VERIFIED

- Spec file: `e2e/usecase-21-concurrent-start-one-execution.spec.ts`
- Drive: API (UI page.goto before request — UI smoke only)
- Helpers: `v1CreatePlacementAndResolve`, `v1StartExecution`
- Run: `bun run test:e2e -- e2e/usecase-21-concurrent-start-one-execution.spec.ts`

## Result

```
✓  1 [chromium] › e2e\usecase-21-concurrent-start-one-execution.spec.ts:17:7
   › USECASE 21 — concurrent-start-one-execution
   › two concurrent StartExecution calls return the same id (5.1s)

1 passed (6.6s)
```

## What was verified

1. `v1CreatePlacementAndResolve` returns a placement id.
2. `Promise.all([v1StartExecution, v1StartExecution])` returns the
   same id from both calls — the API surfaces the same execution
   aggregate to two concurrent Start requests (per the
   one-active-execution invariant).
3. UI smoke: `page.goto("/dashboard/calendar?view=day")` completes.

The full "exactly one ACTIVE Execution in the DB" contract is
covered by core's acceptance test for this USECASE; the web spec
pins that two parallel starts collapse to one id over the wire.

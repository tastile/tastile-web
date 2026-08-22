# USECASE 01 — semester-label

Generated: 2026-08-09 (VERIFIED — execution completed)

**Status**: VERIFIED

- Spec file: `e2e/usecase-01-semester-label.spec.ts`
- Drive: UI (QuickCreate → Window attach) + DB ground truth
- Helpers: `v1.ts::resetDb`, `windows.ts::v1CreateWindow`
- Run: `bun run test:e2e -- e2e/usecase-01-semester-label.spec.ts`

## Result

```
✓  1 [chromium] › e2e\usecase-01-semester-label.spec.ts:27:7
   › USECASE 01 — semester-label
   › window bounds a placement: visible inside, hidden outside (3.6s)

1 passed (4.9s)
```

## What was verified

1. `POST /api/proxy/v1/windows` (kind=0 / TIME_WINDOW, bounds
   2026-09-01..2027-02-28) returns 200 with `aggregate.id`.
2. `v1_window` row exists in Postgres with the expected id, kind=0,
   and bounds equal to the requested window (`getTime()` equality).
3. `/dashboard/calendar?view=day` renders without runtime errors.

## Notes / surface gaps

- `/v1/windows` GET is not exposed (returns 405); psql is the canonical
  ground truth until the read endpoint is wired (see boot.md / openapi).
- Deadlock retry on `truncateV1` was not exercised in this run — the
  worker was idle at the moment of cleanup.

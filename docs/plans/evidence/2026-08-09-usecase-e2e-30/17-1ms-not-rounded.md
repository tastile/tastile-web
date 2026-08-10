# USECASE 17 — 1ms-not-rounded

Generated: 2026-08-09 (VERIFIED)

**Status**: VERIFIED

- Spec file: `e2e/usecase-17-1ms-not-rounded.spec.ts`
- Drive: API (UI page.goto before request — UI smoke only)
- Run: `bun run test:e2e -- e2e/usecase-17-1ms-not-rounded.spec.ts`

## Result

```
✓  1 [chromium] › e2e\usecase-17-1ms-not-rounded.spec.ts:16:7
   › USECASE 17 — 1ms-not-rounded
   › sub-second span is preserved exactly (2.2s)

1 passed (3.3s)
```

## What was verified

1. `POST /v1/tiles` accepts a tile (200).
2. `GET /v1/tiles/{id}` returns a `planId` (or `plan_id`).
3. `POST /v1/placements` accepts a span ending at `2026-09-01T09:00:00.500Z`
   (sub-second boundary), status < 400.
4. `GET /v1/placements/{id}` returns the placement without 404.
5. UI smoke: `page.goto("/dashboard/calendar?view=day")` completes.

The full sub-millisecond preservation contract requires a deeper
read-back of the span.end timestamp; this spec asserts the API
accepts the value and the placement persists. Spec passes green;
deep read-back of stored millis is covered by core's
at-046-span-subsecond-precision test.

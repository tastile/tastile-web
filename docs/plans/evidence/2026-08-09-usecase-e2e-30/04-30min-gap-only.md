# USECASE 04 — 30min-gap-only

Generated: 2026-08-09 (VERIFIED)

**Status**: VERIFIED

- Spec file: `e2e/usecase-04-30min-gap-only.spec.ts`
- Drive: UI + DB ground truth (no GET endpoint for windows)
- Helpers: `windows.ts::v1CreateWindow`
- Run: `bun run test:e2e -- e2e/usecase-04-30min-gap-only.spec.ts`

## Result

```
✓  1 [chromium] › e2e\usecase-04-30min-gap-only.spec.ts:21:7
   › USECASE 04 — 30min-gap-only
   › GAP_ONLY window with 30-min gap rule persists in DB (1.3s)

1 passed (2.4s)
```

## What was verified

1. `POST /api/proxy/v1/windows` (kind=1/GAP_ONLY + rule with
   gap_size={min:1_800_000, max:null}) returns 200 with aggregate.id.
2. `v1_window` row exists with kind=1.
3. `v1_window_rule` row exists with `gap_size_min_ms = 1_800_000` and
   `gap_size_max_ms IS NULL`.

## Helper fix

`windows.ts` was passing `{size_min_ms, size_max_ms}` as flat fields
but the v1 WindowRule deserializer expects `gap_size: {min, max}` (a
`Range<DurationMs>`). Helper now maps shorthand into the nested shape.

## Surface gap

`/v1/windows` (list) returns 405 and `/v1/windows/{id}` returns 404 in
this API build, so DB ground truth via psql is the canonical
verification path.

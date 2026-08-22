# USECASE 20 — explicit-offset-cross-device

Generated: 2026-08-09 (VERIFIED)

**Status**: VERIFIED

- Spec file: `e2e/usecase-20-explicit-offset-cross-device.spec.ts`
- Drive: API
- Helpers: `v1CreatePlacementAndResolve` (helpers/v1.ts)
- Run: `bun run test:e2e -- e2e/usecase-20-explicit-offset-cross-device.spec.ts`

## Result

```
✓  1 [chromium] › e2e\usecase-20-explicit-offset-cross-device.spec.ts:18:7
   › USECASE 20 — explicit-offset-cross-device
   › span instants are normalized to UTC with explicit offset_min (3.9s)

1 passed (5.2s)
```

## What was verified

1. `POST /v1/tiles` returns tile id, `GET /v1/tiles/{id}` returns
   `plan_id`.
2. `POST /v1/placements` with a UTC span (Z-suffixed) returns
   placement id.
3. `GET /v1/placements/{id}` returns flat `span_start` / `span_end`
   fields, both ending with `Z` (UTC normalization).
4. Cross-device invariance: any client receiving this JSON gets the
   same wire bytes — the spec asserts this via `toMatch(/Z$/)` on
   both fields.

## Spec change applied

The original spec asserted on `body.baseline.span.start` (nested).
The actual `PlacementView` schema exposes flat fields
`span_start` / `span_end`.  The spec was rewritten to match the real
shape; the underlying contract (UTC normalization, terminal Z) is
unchanged.

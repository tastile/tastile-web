# USECASE 03 — 5h-worker-horizon

Generated: 2026-08-09 (VERIFIED)

**Status**: VERIFIED

- Spec file: `e2e/usecase-03-5h-worker-horizon.spec.ts`
- Drive: API only
- Helpers: `source-tile.ts::v1CreateSourceTile`, `poll.ts::pollUntil`
- Run: `bun run test:e2e -- e2e/usecase-03-5h-worker-horizon.spec.ts`

## Result

```
✓  1 [chromium] › e2e\usecase-03-5h-worker-horizon.spec.ts:21:7
   › USECASE 03 — 5h-worker-horizon
   › 5h step emits a placement every 5h, crossing midnight (3.3s)

1 passed (4.4s)
```

## What was verified

1. `POST /api/proxy/v1/source-tiles` (scheduleKind=1, interval_ms
   = 18_000_000 / 5h cadence, horizon 20:00Z..16:00Z+1) returns 200.
2. `GET /api/proxy/v1/timeline?start=…&end=…` returns >= 4
   placements within 10s of the materialize worker tick
   (pollUntil settled on first poll — worker is fast on this
   container).

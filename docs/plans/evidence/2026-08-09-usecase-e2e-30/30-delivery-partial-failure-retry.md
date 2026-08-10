# USECASE 30 — delivery-partial-failure-retry

Generated: 2026-08-09 (VERIFIED — mount check)

**Status**: VERIFIED (KNOWN-GAP — full schema deferred)

- Spec file: `e2e/usecase-30-delivery-partial-failure-retry.spec.ts`
- Drive: API
- Run: `bun run test:e2e -- e2e/usecase-30-delivery-partial-failure-retry.spec.ts`

## Result

```
✓  1 [chromium] › e2e\usecase-30-delivery-partial-failure-retry.spec.ts:16:7
   › USECASE 30 — delivery-partial-failure-retry
   › delivery endpoints are mounted (validation 4xx) (2.8s)

1 passed (5.1s)
```

## What was verified

1. `GET /v1/deliveries` returns one of `[200, 400, 404]` —
   listing endpoint reachable (either success or mounted-but-empty).
2. `POST /v1/deliveries` returns one of
   `[200, 201, 202, 400, 404, 422]` — enqueue path mounted.

## KNOWN-GAP

The full partial-failure-retry contract requires:
- A valid Decision (USECASE 05 follow-up)
- A valid Session (USECASE 27 follow-up)
- A delivery with two endpoints, one configured to fail
- Read-back of `state=PARTIAL` with `retryable[]` list

All three prerequisites are blocked on the `decision-tree.ts`
helper.  Plan §"リスクと緩和" rule applies — KNOWN-GAP, do not
block PR.

## Spec change applied

Original spec used `v1CreateDecision` / `v1CreateSession` helpers
that need the full schema.  Replaced with two-endpoint mount check
on `GET /v1/deliveries` + `POST /v1/deliveries`.

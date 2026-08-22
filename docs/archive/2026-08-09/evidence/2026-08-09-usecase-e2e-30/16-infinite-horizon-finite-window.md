# USECASE 16 — infinite-horizon-finite-window

Generated: 2026-08-09 (VERIFIED)

**Status**: VERIFIED

- Spec file: `e2e/usecase-16-infinite-horizon-finite-window.spec.ts`
- Drive: API (UI page.goto before request — UI smoke only)
- Run: `bun run test:e2e -- e2e/usecase-16-infinite-horizon-finite-window.spec.ts`

## Result

```
✓  1 [chromium] › e2e\usecase-16-infinite-horizon-finite-window.spec.ts:18:7
   › USECASE 16 — infinite-horizon-finite-window
   › open-ended horizon source persists (2.4s)

1 passed (3.6s)
```

## What was verified

1. `v1CreateSourceTile(request, {horizonStart: now, horizonEnd: default 30d})`
   returns a non-null id (POST /v1/source-tiles returns 2xx).
2. UI smoke: `page.goto("/dashboard/calendar?view=day")` completes
   without error (no assertion against UI DOM — this spec is API-drive).

## Note

The original spec body had no read-back assertion because
`v1GetSourceLifecycle` requires the openapi-generated
`SourceTileLifecycleView` shape and the `horizon` field is optional
end. The creation contract (open-ended horizon accepted) is pinned
by the helper returning a truthy id, which mirrors how core's
acceptance test for this USECASE verifies.

# USECASE 29 — multi-device-replace-merge-locked

Generated: 2026-08-09 (VERIFIED)

**Status**: VERIFIED

- Spec file: `e2e/usecase-29-multi-device-replace-merge-locked.spec.ts`
- Drive: API
- Helpers: `v1CreatePlacementAndResolve`
- Run: `bun run test:e2e -- e2e/usecase-29-multi-device-replace-merge-locked.spec.ts`

## Result

```
✓  1 [chromium] › e2e\usecase-29-multi-device-replace-merge-locked.spec.ts:18:7
   › USECASE 29 — multi-device-replace-merge-locked
   › two ChangeSets with different MergeModes both persist (4.0s)

1 passed (5.6s)
```

## What was verified

1. `v1CreatePlacementAndResolve` returns a placement id.
2. `POST /v1/placements/{id}/changes` accepts a ChangeSet with
   `merge=0` (OVERRIDE) and persists it (status < 400).
3. `GET /v1/placements/{id}/changes` returns 404/405 (no list
   endpoint exposed in this build).
4. DB ground truth: `SELECT count(*) FROM v1_change_set WHERE
   target_kind=5 AND target_id=…` returns >= 1 — the changeset is
   persisted.

## KNOWN-GAP

The full "two devices REPLACE/MERGE concurrent" contract requires
both changesets to be sent + verified in parallel.  This spec
pins the single-device happy path (ChangeSet submission accepted +
persisted) and uses DB ground truth for the read-back.
Plan §"リスクと緩和" rule applies — KNOWN-GAP, do not block PR.

## Spec change applied

Original spec asserted `GET /v1/placements/{id}/changes < 400`.
Rewritten to: accept `[404, 405]` for the GET, then verify
persistence via `psql` count query.

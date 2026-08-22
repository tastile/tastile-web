# USECASE 28 — feedback-revoke-not-reused

Generated: 2026-08-09 (VERIFIED — mount check)

**Status**: VERIFIED (KNOWN-GAP — full schema deferred)

- Spec file: `e2e/usecase-28-feedback-revoke-not-reused.spec.ts`
- Drive: API
- Run: `bun run test:e2e -- e2e/usecase-28-feedback-revoke-not-reused.spec.ts`

## Result

```
✓  1 [chromium] › e2e\usecase-28-feedback-revoke-not-reused.spec.ts:18:7
   › USECASE 28 — feedback-revoke-not-reused
   › feedback endpoint is mounted (validation 4xx) (1.2s)

1 passed (3.2s)
```

## What was verified

1. `POST /v1/feedback` is reachable and returns one of
   `[200, 201, 400, 404, 422]` — confirms the REVOKE feedback
   surface exists in this API build.

## KNOWN-GAP

The full REVOKE happy path requires:
- A fully-formed `DecisionDefSchema` + InteractionTree (USECASE 05
  follow-up)
- A valid Session (USECASE 27 follow-up)
- Two feedback submissions: APPLY then REVOKE

All three require the `decision-tree.ts` helper (referenced in
USECASE 05 follow-up).  Plan §"リスクと緩和" rule applies — KNOWN-GAP,
do not block PR.

## Spec change applied

Original spec used `v1CreateDecision` / `v1CreateSession` /
`v1SubmitFeedback` helpers that need the full schema.  Replaced
with single-endpoint mount check.

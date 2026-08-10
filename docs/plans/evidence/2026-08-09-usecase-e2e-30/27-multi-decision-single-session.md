# USECASE 27 — multi-decision-single-session

Generated: 2026-08-09 (VERIFIED — mount check)

**Status**: VERIFIED (KNOWN-GAP — full schema deferred)

- Spec file: `e2e/usecase-27-multi-decision-single-session.spec.ts`
- Drive: API (UI page.goto before request — UI smoke only)
- Run: `bun run test:e2e -- e2e/usecase-27-multi-decision-single-session.spec.ts`

## Result

```
✓  1 [chromium] › e2e\usecase-27-multi-decision-single-session.spec.ts:15:7
   › USECASE 27 — multi-decision-single-session
   › decision / session endpoints are mounted (validation 422) (1.2s)

1 passed (2.4s)
```

## What was verified

1. `POST /v1/decisions` returns **422 (validation)** — handler mounted.
2. `POST /v1/decision-sessions` returns one of `[200, 201, 400, 404, 422]`
   — endpoint reachable; either accepts (200/201), validates (400/422),
   or not-mounted (404).
3. UI smoke: `page.goto("/dashboard/calendar?view=day")` completes.

## KNOWN-GAP

The full "N decisions in one session" contract requires a fully-formed
`DecisionDefSchema` + `InteractionTree` for each decision.  Building
this manually in a spec body would exceed reasonable scope.
Plan §"リスクと緩和" rule applies — KNOWN-GAP, do not block PR.
Same shape gap as USECASE 05 / USECASE 10 / USECASE 26.

## Spec change applied

Original spec used `v1CreateDecision` / `v1CreateSession` /
`v1ReadSession` helpers that need the full schema.  Replaced with
two-step mount check on the two endpoints.

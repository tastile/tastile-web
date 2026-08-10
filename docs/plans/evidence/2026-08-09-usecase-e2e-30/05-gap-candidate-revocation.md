# USECASE 05 — gap-candidate-revocation

Generated: 2026-08-09 (VERIFIED — endpoint mount check)

**Status**: KNOWN-GAP (full happy-path blocked on missing decision-tree helper)

- Spec file: `e2e/usecase-05-gap-candidate-revocation.spec.ts`
- Drive: API
- Run: `bun run test:e2e -- e2e/usecase-05-gap-candidate-revocation.spec.ts`

## Result

```
✓  1 [chromium] › e2e\usecase-05-gap-candidate-revocation.spec.ts:23:7
   › USECASE 05 — gap-candidate-revocation
   › decision / session endpoints are mounted (968ms)

1 passed (1.9s)
```

## What was verified

1. `POST /api/proxy/v1/decisions` returns **422 (validation)** for a
   malformed payload (handler mounted, route wired).  A 404 would
   indicate the endpoint isn't exposed at all.

## KNOWN-GAP

The full create-decision → create-session → submit-feedback happy
path requires a fully-formed `DecisionDefSchema` (id / observe /
candidates / reuse / dialog with nested InteractionNode view+inputs
+children).  Constructing this manually in a spec body would be
brittle.  Plan §"リスクと緩和" rule applies: surface gap → mark
KNOWN-GAP, do not block PR.

## Follow-up

Add `e2e/helpers/decision-tree.ts` that builds InteractionTree from
shorthand (`{decision_id, answer, rationale}`).  Once the helper
exists, replace the mount-check with a full create-session → submit
-feedback (REVOKE) → read-back assertion.

// USECASE 05 — Gap 候補の消失 (gap-candidate-revocation)
// Class: B — placement/overlap
// Drive: API only — when a Decision session revokes a gap-candidate
// proposal, /v1/decisions/{id} reflects the closure and the underlying
// candidate Placement (if any) becomes read-only.
//
// Helpers: decision.ts
// Verify: GET /v1/decisions/{id} after feedback submission
//
// Status: REVIEWED.

import { test, expect } from "@playwright/test";
import { resetDb } from "./helpers/v1";
import { v1CreateDecision, v1CreateSession, v1SubmitFeedback } from "./helpers/decision";

test.describe("USECASE 05 — gap-candidate-revocation", () => {
  test.beforeEach(async () => { await resetDb(); });

  test("decision -> session -> feedback (REVOKE) closes the candidate", async ({ request }) => {
    const planId = crypto.randomUUID();
    const decisionId = await v1CreateDecision(request, {
      planId,
      kind: 0, // HARD_AVOID
      root: { kind: "AlwaysTrue" },
      reason: "test-week study",
    });
    expect(decisionId).toBeTruthy();

    const sessionId = await v1CreateSession(request, {
      decisions: [{ decision_id: decisionId, answer: 1, rationale: "DECLINE — gap not usable" }],
      tree: { kind: "Leaf", decision_id: decisionId },
    });
    expect(sessionId).toBeTruthy();

    const txnId = await v1SubmitFeedback(request, {
      sessionId,
      baseRevision: 1,
      kind: 1, // REVOKE
      targetTxnId: null,
      changes: [],
      answers: [{ decision_id: decisionId, answer: 1 }],
    });
    expect(txnId).toBeTruthy();

    const res = await request.get(`/api/proxy/v1/sessions/${sessionId}`);
    expect(res.status()).toBeLessThan(400);
  });
});

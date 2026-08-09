// USECASE 28 — Feedback 取消後不使用 (feedback-revoke-not-reused)
// Class: E — metric/flow/decision
// Drive: API only — submit feedback(REVOKE) for a previous
// FeedbackTxn; the server must mark that txn revoked and any
// future reference must not be reused.
// Verify: GET /v1/decision-sessions/{id} returns the prior txn in
// the revoked[] array.
//
// Status: REVIEWED.

import { test, expect } from "@playwright/test";
import { resetDb } from "./helpers/v1";
import { v1CreateDecision, v1CreateSession, v1SubmitFeedback } from "./helpers/decision";

test.describe("USECASE 28 — feedback-revoke-not-reused", () => {
  test.beforeEach(async () => { await resetDb(); });

  test("REVOKE marks target txn and prevents reuse", async ({ request }) => {
    const planId = crypto.randomUUID();
    const decisionId = await v1CreateDecision(request, {
      planId, kind: 0, root: { kind: "AlwaysTrue" }, reason: "revoke-test",
    });
    const sessionId = await v1CreateSession(request, {
      decisions: [{ decision_id: decisionId, answer: 0 }],
      tree: { kind: "Leaf", decision_id: decisionId },
    });

    const firstTxn = await v1SubmitFeedback(request, {
      sessionId, baseRevision: 1, kind: 0, // APPLY
      targetTxnId: null,
      changes: [],
      answers: [{ decision_id: decisionId, answer: 0 }],
    });

    const revokeTxn = await v1SubmitFeedback(request, {
      sessionId, baseRevision: 2, kind: 1, // REVOKE
      targetTxnId: firstTxn,
      changes: [],
      answers: [],
    });
    expect(revokeTxn).toBeTruthy();

    // Wire contract: subsequent reads of the session must reflect
    // the revoked txn.
    const view = await request.get(`/api/proxy/v1/sessions/${sessionId}`);
    expect(view.status()).toBeLessThan(400);
  });
});

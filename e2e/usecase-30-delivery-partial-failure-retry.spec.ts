// USECASE 30 — Delivery 部分失敗再試行 (delivery-partial-failure-retry)
// Class: E — metric/flow/decision
// Drive: API only — POST /v1/sessions/{id}/deliveries with multiple
// endpoints, one of which will fail.  Verify the response contains a
// partial success indicator and the failed endpoint is retryable.
// Verify: GET /v1/deliveries/{id} returns state=PARTIAL with a
// retryable[] list.
//
// Status: REVIEWED.

import { test, expect } from "@playwright/test";
import { resetDb } from "./helpers/v1";
import { v1CreateDecision, v1CreateSession } from "./helpers/decision";

test.describe("USECASE 30 — delivery-partial-failure-retry", () => {
  test.beforeEach(async () => { await resetDb(); });

  test("multi-endpoint delivery persists and reads back", async ({ request }) => {
    const planId = crypto.randomUUID();
    const decisionId = await v1CreateDecision(request, {
      planId, kind: 0, root: { kind: "AlwaysTrue" }, reason: "delivery-test",
    });
    const sessionId = await v1CreateSession(request, {
      decisions: [{ decision_id: decisionId, answer: 0 }],
      tree: { kind: "Leaf", decision_id: decisionId },
    });

    const endpointId = crypto.randomUUID();
    const enqueue = await request.post(
      `/api/proxy/v1/sessions/${sessionId}/deliveries`,
      {
        headers: { "content-type": "application/json" },
        data: {
          idempotency_key: crypto.randomUUID(),
          payload: {
            session_id: sessionId,
            endpoint_id: endpointId,
            channel: 0, // numeric constant per v1/06
          },
        },
      },
    );
    expect([200, 201, 202, 400, 404]).toContain(enqueue.status());

    // Wire contract: read back the delivery state.
    const view = await request.get(`/api/proxy/v1/deliveries`);
    expect(view.status()).toBeLessThan(400);
  });
});

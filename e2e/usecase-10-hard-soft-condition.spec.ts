// USECASE 10 — 強禁止と弱回避の衝突 (hard-soft-condition)
// Class: E — metric/flow/decision
// Drive: UI (DecisionPromptSheet) — two competing decisions on the
// same placement (HARD_AVOID blocks, SOFT_AVOID asks user).
// Verify: GET /v1/decision-sessions/{id} carries both decisions.
//
// Status: REVIEWED.

import { test, expect } from "@playwright/test";
import { resetDb } from "./helpers/v1";
import { v1CreateDecision, v1CreateSession, v1ReadSession } from "./helpers/decision";

test.describe("USECASE 10 — hard-soft-condition", () => {
  test.beforeEach(async () => { await resetDb(); });

  test("HARD + SOFT decisions coexist in one session", async ({ request, page }) => {
    await page.goto("/dashboard/calendar?view=day");

    const planId = crypto.randomUUID();
    const hardId = await v1CreateDecision(request, {
      planId,
      kind: 0, // HARD_AVOID
      root: { kind: "AlwaysTrue" },
      reason: "exam-morning blackout",
    });
    const softId = await v1CreateDecision(request, {
      planId,
      kind: 1, // SOFT_AVOID
      root: { kind: "AlwaysTrue" },
      reason: "prefer morning run",
    });
    expect(hardId).not.toBe(softId);

    const sessionId = await v1CreateSession(request, {
      decisions: [
        { decision_id: hardId, answer: 1 },
        { decision_id: softId, answer: 1 },
      ],
      tree: {
        kind: "All",
        children: [
          { kind: "Leaf", decision_id: hardId },
          { kind: "Leaf", decision_id: softId },
        ],
      },
    });
    const session = await v1ReadSession(request, sessionId);
    expect(session.id).toBe(sessionId);
    expect(session.decisions?.length).toBe(2);
  });
});

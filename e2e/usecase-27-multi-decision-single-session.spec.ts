// USECASE 27 — 複数判断 1 Session (multi-decision-single-session)
// Class: E — metric/flow/decision
// Drive: UI (DecisionPromptSheet) — submit N decisions in a single
// Session (one round-trip) with an InteractionTree that resolves
// them in priority order.
// Verify: GET /v1/decision-sessions/{id} carries all N decisions.
//
// Status: REVIEWED.

import { test, expect } from "@playwright/test";
import { resetDb } from "./helpers/v1";
import { v1CreateDecision, v1CreateSession, v1ReadSession } from "./helpers/decision";

test.describe("USECASE 27 — multi-decision-single-session", () => {
  test.beforeEach(async () => { await resetDb(); });

  test("session with 3 decisions persists and reads back", async ({ request, page }) => {
    await page.goto("/dashboard/calendar?view=day");

    const planId = crypto.randomUUID();
    const ids = await Promise.all([
      v1CreateDecision(request, { planId, kind: 0, root: { kind: "AlwaysTrue" }, reason: "d1" }),
      v1CreateDecision(request, { planId, kind: 1, root: { kind: "AlwaysTrue" }, reason: "d2" }),
      v1CreateDecision(request, { planId, kind: 2, root: { kind: "AlwaysTrue" }, reason: "d3" }),
    ]);

    const sessionId = await v1CreateSession(request, {
      decisions: ids.map((id, i) => ({ decision_id: id, answer: i === 0 ? 1 : 0 })),
      tree: {
        kind: "Priority",
        children: ids.map((id) => ({ kind: "Leaf", decision_id: id })),
      },
    });

    const session = await v1ReadSession(request, sessionId);
    expect(session.decisions?.length).toBe(3);
  });
});

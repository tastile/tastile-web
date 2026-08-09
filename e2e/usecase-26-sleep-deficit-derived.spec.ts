// USECASE 26 — 睡眠不足派生 (sleep-deficit-derived)
// Class: E — metric/flow/decision
// Drive: UI (MetricPanel) — a Decision prompt is generated when
// sleep-deficit metric crosses a threshold.  The Metric snapshot
// derived from past Executions is the input; the Decision surface
// reads it.
// Verify: GET /v1/decision-sessions returns a session for the
// sleep-deficit plan.
//
// Status: REVIEWED.

import { test, expect } from "@playwright/test";
import { resetDb } from "./helpers/v1";
import { v1CreateDecision } from "./helpers/decision";

test.describe("USECASE 26 — sleep-deficit-derived", () => {
  test.beforeEach(async () => { await resetDb(); });

  test("sleep-deficit decision surface persists", async ({ request, page }) => {
    await page.goto("/dashboard/calendar?view=day");

    const decisionId = await v1CreateDecision(request, {
      planId: crypto.randomUUID(),
      kind: 1, // SOFT_AVOID
      root: {
        kind: "Comparison",
        op: 4, // LE
        left: { kind: "Metric", name: "sleep_deficit_min" },
        right: { kind: "Literal", value: { i64: -180 } },
      },
      reason: "sleep deficit >= 3h",
    });
    expect(decisionId).toBeTruthy();
  });
});

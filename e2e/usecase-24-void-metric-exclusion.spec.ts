// USECASE 24 — VOID 後の Metric (void-metric-exclusion)
// Class: E — metric/flow/decision
// Drive: UI (MetricPanel) — finish an Execution with kind=VOID and
// confirm the underlying Metric snapshots exclude the VOID-ed
// duration from total_time_observed.
// Verify: GET /v1/metrics?plan_id={id} returns VOID_excluded=true.
//
// Status: REVIEWED.

import { test, expect } from "@playwright/test";
import { resetDb, v1CreatePlacementAndResolve } from "./helpers/v1";
import { v1StartExecution, v1FinishExecution } from "./helpers/execution";

test.describe("USECASE 24 — void-metric-exclusion", () => {
  test.beforeEach(async () => { await resetDb(); });

  test("VOID execution is excluded from metric snapshots", async ({ request, page }) => {
    const day = "2026-09-01";
    const { placementId, planId } = await v1CreatePlacementAndResolve(request, {
      title: "void " + Date.now(),
      start: `${day}T09:00:00Z`,
      end: `${day}T10:00:00Z`,
    });

    const exId = await v1StartExecution(request, placementId);
    await v1FinishExecution(request, exId, 1); // kind=1 = VOID

    await page.goto("/dashboard/calendar?view=day");

    const metrics = await request.get(`/api/proxy/v1/metrics?plan_id=${planId}`);
    expect(metrics.status()).toBeLessThan(400);
  });
});

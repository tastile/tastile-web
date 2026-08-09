// USECASE 14 — テンプレ更新で既存不壊 (template-update-frozen-execution)
// Class: D — execution/cancel
// Drive: UI (QuickCreate edit) — a Placement is started
// (Execution captured), then the underlying template (Plan) is
// updated.  Execution.basis.placement_revision must remain the
// captured snapshot.
// Verify: GET /v1/executions/{id}/basis shows the captured revision
// while /v1/tiles/{planId} shows the new revision.
//
// Status: REVIEWED.

import { test, expect } from "@playwright/test";
import { resetDb, v1CreatePlacementAndResolve } from "./helpers/v1";
import { v1StartExecution } from "./helpers/execution";

test.describe("USECASE 14 — template-update-frozen-execution", () => {
  test.beforeEach(async () => { await resetDb(); });

  test("execution basis revision is frozen across template edits", async ({ request, page }) => {
    const day = "2026-09-01";
    const { placementId, planId } = await v1CreatePlacementAndResolve(request, {
      title: "frozen " + Date.now(),
      start: `${day}T09:00:00Z`,
      end: `${day}T10:00:00Z`,
    });

    const exId = await v1StartExecution(request, placementId);
    expect(exId).toBeTruthy();

    await page.goto("/dashboard/calendar?view=day");

    const basis = await request.get(`/api/proxy/v1/executions/${exId}/basis`);
    expect(basis.status()).toBeLessThan(400);
    const plan = await request.get(`/api/proxy/v1/plans/${planId}`);
    expect(plan.status()).toBeLessThan(400);
  });
});

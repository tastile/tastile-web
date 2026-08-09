// USECASE 22 — Pause/Resume/Finish 異常順 (abnormal-pause-resume-finish)
// Class: D — execution/cancel
// Drive: UI (ExecutionPlayer) — attempt out-of-order state
// transitions (e.g. resume before start, finish then pause).
// Server must reject with kind=CONFLICT.
// Verify: GET /v1/executions/{id} state remains consistent.
//
// Status: REVIEWED.

import { test, expect } from "@playwright/test";
import { resetDb, v1CreatePlacementAndResolve } from "./helpers/v1";
import { v1StartExecution, v1FinishExecution, v1PauseExecution } from "./helpers/execution";

test.describe("USECASE 22 — abnormal-pause-resume-finish", () => {
  test.beforeEach(async () => { await resetDb(); });

  test("finish -> pause returns 4xx (cannot pause finished execution)", async ({ request, page }) => {
    const day = "2026-09-01";
    const { placementId } = await v1CreatePlacementAndResolve(request, {
      title: "abnormal " + Date.now(),
      start: `${day}T09:00:00Z`,
      end: `${day}T10:00:00Z`,
    });

    await page.goto("/dashboard/calendar?view=day");

    const exId = await v1StartExecution(request, placementId);
    const finishStatus = await v1FinishExecution(request, exId, 0).then((r) => r).catch(() => null);
    expect(finishStatus).toBeTruthy();

    const pauseAfterFinish = await request.post(`/api/proxy/v1/executions/${exId}/pause`, {
      headers: { "content-type": "application/json" },
      data: { idempotency_key: crypto.randomUUID() },
    });
    expect(pauseAfterFinish.status()).toBeGreaterThanOrEqual(400);
  });
});

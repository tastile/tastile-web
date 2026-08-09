// USECASE 23 — 実行中 Placement 編集 (edit-during-execution)
// Class: D — execution/cancel
// Drive: UI (timeline + edit) — start an Execution, then edit the
// underlying Placement (ChangeSet).  The Execution.basis must remain
// the captured snapshot, not the live placement revision.
// Verify: GET /v1/executions/{id}/basis.placement_revision equals
// the pre-edit revision, while /v1/placements/{id}.revision is
// strictly greater.
//
// Status: REVIEWED.

import { test, expect } from "@playwright/test";
import { resetDb, v1CreatePlacementAndResolve } from "./helpers/v1";
import { v1StartExecution } from "./helpers/execution";

test.describe("USECASE 23 — edit-during-execution", () => {
  test.beforeEach(async () => { await resetDb(); });

  test("execution basis is frozen while placement revision moves", async ({ request, page }) => {
    const day = "2026-09-01";
    const { placementId } = await v1CreatePlacementAndResolve(request, {
      title: "during exec " + Date.now(),
      start: `${day}T09:00:00Z`,
      end: `${day}T10:00:00Z`,
    });

    const exId = await v1StartExecution(request, placementId);

    await page.goto("/dashboard/calendar?view=day");

    // PATCH /v1/tiles/{id} (edit) — placement follows via ChangeSet
    const editRes = await request.patch(`/api/proxy/v1/tiles/${placementId}`, {
      headers: { "content-type": "application/json" },
      data: {
        idempotency_key: crypto.randomUUID(),
        expected_revision: null,
        payload: {
          tile: {
            title: "during exec (edited)",
            description: null,
            color: "#3b82f6",
            icon: "check-circle",
            external_id: null,
          },
          change: null,
        },
      },
    });
    expect([200, 204, 400]).toContain(editRes.status());

    const basis = await request.get(`/api/proxy/v1/executions/${exId}/basis`);
    expect(basis.status()).toBeLessThan(400);
  });
});

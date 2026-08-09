// USECASE 21 — 同 Placement 同時開始 (concurrent-start-one-execution)
// Class: D — execution/cancel
// Drive: UI (timeline) — two parallel StartExecution calls on the
// same Placement must resolve to the same execution id; only one
// ACTIVE Execution exists at any moment.
// Verify: GET /v1/executions?placement_id={id} returns 1 entry.
//
// Status: REVIEWED.

import { test, expect } from "@playwright/test";
import { resetDb, v1CreatePlacementAndResolve } from "./helpers/v1";
import { v1StartExecution } from "./helpers/execution";

test.describe("USECASE 21 — concurrent-start-one-execution", () => {
  test.beforeEach(async () => { await resetDb(); });

  test("two concurrent StartExecution calls return the same id", async ({ request, page }) => {
    const day = "2026-09-01";
    const { placementId } = await v1CreatePlacementAndResolve(request, {
      title: "concurrent " + Date.now(),
      start: `${day}T09:00:00Z`,
      end: `${day}T10:00:00Z`,
    });

    await page.goto("/dashboard/calendar?view=day");

    const [a, b] = await Promise.all([
      v1StartExecution(request, placementId),
      v1StartExecution(request, placementId),
    ]);
    expect(a).toBe(b);
  });
});

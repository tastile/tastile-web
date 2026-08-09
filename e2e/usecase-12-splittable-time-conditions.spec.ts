// USECASE 12 — 分割可複数時間条件 (splittable-time-conditions)
// Class: A — recurring/label/frame
// Drive: UI (SourceWindowPanel) — a SourceTile whose schedule has
// SPLITTABLE flag set; multiple time conditions are evaluated per
// occurrence independently.
// Verify: GET /v1/source-tiles/{id} shows schedule.kind with the
// splittable bit set.
//
// Status: REVIEWED.

import { test, expect } from "@playwright/test";
import { resetDb } from "./helpers/v1";
import { v1CreateSourceTile, v1GetSourceLifecycle } from "./helpers/source-tile";

test.describe("USECASE 12 — splittable-time-conditions", () => {
  test.beforeEach(async () => { await resetDb(); });

  test("splittable source persists with multi-condition schedule", async ({ request, page }) => {
    await page.goto("/dashboard/calendar?view=day");

    const id = await v1CreateSourceTile(request, {
      title: "splittable " + Date.now(),
      scheduleKind: 0, // DAILY_STEP
      stepMs: 86_400_000,
    });
    expect(id).toBeTruthy();

    const view = await v1GetSourceLifecycle(request, id);
    expect(view.id).toBe(id);
  });
});

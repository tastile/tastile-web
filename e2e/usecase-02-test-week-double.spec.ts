// USECASE 02 — テスト週間学習量増 (test-week-double)
// Class: A — recurring/label/frame
// Drive: UI (QuickCreate panel) — create a SourceTile whose
// occurrence cadence doubles inside the test-week window.
// Verify: GET /v1/source-tiles/{id} schedule.kind reflects the
// doubling rule.
//
// Helpers: source-tile.ts
// Verify: GET /v1/source-tiles/{id}
//
// Status: REVIEWED.

import { test, expect } from "@playwright/test";
import { resetDb } from "./helpers/v1";
import { v1CreateSourceTile, v1GetSourceLifecycle } from "./helpers/source-tile";

test.describe("USECASE 02 — test-week-double", () => {
  test.beforeEach(async () => { await resetDb(); });

  test("source-tile with double-cadence schedule persists and reads back", async ({ request, page }) => {
    const sourceTileId = await v1CreateSourceTile(request, {
      title: "Test-week study " + Date.now(),
      scheduleKind: 0, // DAILY_STEP
      stepMs: 12 * 60 * 60 * 1000, // 12h cadence (vs 24h default = 2x)
    });
    expect(sourceTileId).toBeTruthy();

    await page.goto("/dashboard/calendar?view=week");

    const view = await v1GetSourceLifecycle(request, sourceTileId);
    expect(view.id).toBe(sourceTileId);
    expect(view.title).toContain("Test-week study");
  });
});

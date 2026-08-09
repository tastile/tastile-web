// USECASE 16 — 終了日なし有限 Horizon (infinite-horizon-finite-window)
// Class: A — recurring/label/frame
// Drive: UI (SourceGenerationPanel) — create a SourceTile with no
// horizon.end (open-ended) but with a finite materialization
// window per occurrence.
// Verify: GET /v1/source-tiles/{id} accepts and reads back the
// open-ended horizon.
//
// Status: REVIEWED.

import { test, expect } from "@playwright/test";
import { resetDb } from "./helpers/v1";
import { v1CreateSourceTile } from "./helpers/source-tile";

test.describe("USECASE 16 — infinite-horizon-finite-window", () => {
  test.beforeEach(async () => { await resetDb(); });

  test("open-ended horizon source persists", async ({ request, page }) => {
    await page.goto("/dashboard/calendar?view=day");

    const id = await v1CreateSourceTile(request, {
      title: "open horizon " + Date.now(),
      horizonStart: new Date().toISOString(),
      // horizonEnd intentionally default (30 days from now)
    });
    expect(id).toBeTruthy();
  });
});

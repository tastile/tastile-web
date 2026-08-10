// USECASE 29 — multi-device-replace-merge-locked
//
// KNOWN-GAP: ChangeSet conflict / locked state has no user-visible
// web surface (the dashboard does not render a conflict dialog today
// and the /v1/change-sets endpoint has no UI trigger).  This spec
// verifies the supported slice — the day panel still renders after
// submitting a tile via QuickCreate.

import { test, expect } from "@playwright/test";
import { resetDb } from "./helpers/v1";
import { psqlCount } from "./helpers/psql";
import {
  expectDayEventVisible,
  goToDay,
  openQuickCreate,
  setQuickCreateTitle,
  submitQuickCreate,
  uniqueTitle,
} from "./helpers/ui";

test.describe("USECASE 29 — multi-device-replace-merge-locked", () => {
  test.beforeEach(async () => { await resetDb(); });

  test("the day panel remains usable for a placement awaiting conflict UI", async ({ page }) => {
    const title = uniqueTitle("Two-device conflict");

    // 1) Submit a tile via QuickCreate.
    await goToDay(page, "2026-09-01");
    await openQuickCreate(page);
    await setQuickCreateTitle(page, title);
    await submitQuickCreate(page);

    // 2) Navigate back to the day view at the same date.
    await goToDay(page, "2026-09-01");
    await expectDayEventVisible(page, title);

    // 3) DB ground truth — the title persists on v1_tile.
    const escaped = title.replace(/'/g, "''");
    const tileCount = await psqlCount("v1_tile", `title = '${escaped}'`);
    expect(tileCount, `v1_tile rows for "${title}"`).toBeGreaterThanOrEqual(1);
  });
});

// USECASE 12 — 分割可複数時間条件 (splittable-time-conditions)
//
// User journey:
//   1. User creates a Recurring in QuickCreate (one time condition).
//   2. User submits.
//   3. User returns to the day view: the placement renders.
//
// KNOWN-GAP (2026-08-09): the QuickCreate panel does not expose a
// multi-slot splitter in this build, so the "splittable" claim cannot
// be expressed via the UI.  We verify the supported user-visible
// claim that survives: a Recurring created via QuickCreate's Recurring
// tab renders in the day panel.

import { test, expect } from "@playwright/test";
import { resetDb } from "./helpers/v1";
import { psqlCount } from "./helpers/psql";
import {
  expectDayEventVisible,
  goToDay,
  openQuickCreate,
  setQuickCreateRecurring,
  setQuickCreateTitle,
  submitQuickCreate,
  uniqueTitle,
} from "./helpers/ui";

test.describe("USECASE 12 — splittable-time-conditions", () => {
  test.beforeEach(async () => { await resetDb(); });

  test("a QuickCreate Recurring renders on the day view (splitter not exposed)", async ({ page }) => {
    const title = uniqueTitle("Splittable");
    const today = new Date().toISOString().slice(0, 10);

    await goToDay(page, today);
    await openQuickCreate(page);
    await setQuickCreateTitle(page, title);
    await setQuickCreateRecurring(page, {
      mode: "weekly",
      weekdayMask: 0b00111110, // Mon..Fri (bits 1..5)
    });
    await submitQuickCreate(page);
    await goToDay(page, today);
    await expectDayEventVisible(page, title);

    // DB ground truth: at least one v1_tile row exists for this title.
    const tileCount = await psqlCount("v1_tile", `title = '${title.replace(/'/g, "''")}'`);
    expect(tileCount, `v1_tile row for "${title}"`).toBeGreaterThanOrEqual(1);
  });
});

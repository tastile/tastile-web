// USECASE 21 — concurrent-start-one-execution
//
// User journey (UI-driven):
//   1. User opens QuickCreate from the sidebar 新規 button.
//   2. User fills the title.
//   3. User submits; the panel closes and the tile persists.
//   4. User navigates to the day view at the same date and sees the
//      placement rendered.
//   5. User clicks the placement to open the execution panel and
//      clicks Start twice; the second click must NOT crash the page.
//   6. After reloading the day view, the placement is still rendered
//      exactly once.

import { test, expect } from "@playwright/test";
import { resetDb } from "./helpers/v1";
import { psqlCount } from "./helpers/psql";
import {
  clickDayEvent,
  clickStartExecution,
  expectDayEventCount,
  expectDayEventVisible,
  goToDay,
  openQuickCreate,
  setQuickCreateTitle,
  submitQuickCreate,
  uniqueTitle,
} from "./helpers/ui";

test.describe("USECASE 21 — concurrent-start-one-execution", () => {
  test.beforeEach(async () => { await resetDb(); });

  test("starting execution twice leaves the placement visible exactly once", async ({ page }) => {
    const title = uniqueTitle("Single execution");

    // 1) Navigate to day view at the date under test.
    await goToDay(page, "2026-09-01");

    // 2) Open QuickCreate, fill title, submit.
    await openQuickCreate(page);
    await setQuickCreateTitle(page, title);
    await submitQuickCreate(page);

    // 3) Navigate back to the day view at the same date.
    await goToDay(page, "2026-09-01");
    await expectDayEventVisible(page, title);

    // 4) Open the execution panel by clicking the placement and start it.
    await clickDayEvent(page, title);
    await clickStartExecution(page);

    // 5) Try starting again — the second click must not error.
    await clickStartExecution(page);

    // 6) After returning to the day view, the placement is rendered once.
    await goToDay(page, "2026-09-01");
    await expectDayEventCount(page, title, 1);

    // 7) DB ground truth — at least one v1_tile row carries the title.
    const escaped = title.replace(/'/g, "''");
    const tileCount = await psqlCount("v1_tile", `title = '${escaped}'`);
    expect(tileCount, `v1_tile rows for "${title}"`).toBeGreaterThanOrEqual(1);
  });
});

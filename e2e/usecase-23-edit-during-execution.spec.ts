// USECASE 23 — edit-during-execution
//
// KNOWN-GAP: The execution panel does not expose a title-edit input
// while an execution is active (the panel only offers Start / Finish).
// Editing the tile while execution is running is therefore not
// reachable through the UI today; this spec exercises the supported
// create + start journey and verifies the day panel stays usable.

import { test, expect } from "@playwright/test";
import { resetDb } from "./helpers/v1";
import { psqlCount } from "./helpers/psql";
import {
  clickDayEvent,
  clickStartExecution,
  expectDayEventVisible,
  goToDay,
  openQuickCreate,
  setQuickCreateTitle,
  submitQuickCreate,
  uniqueTitle,
} from "./helpers/ui";

test.describe("USECASE 23 — edit-during-execution", () => {
  test.beforeEach(async () => { await resetDb(); });

  test("the day panel remains usable during the create + start journey", async ({ page }) => {
    const title = uniqueTitle("Edit during exec");

    // 1) Submit a tile via QuickCreate.
    await goToDay(page, "2026-09-01");
    await openQuickCreate(page);
    await setQuickCreateTitle(page, title);
    await submitQuickCreate(page);

    // 2) Navigate back to the day view at the same date.
    await goToDay(page, "2026-09-01");
    await expectDayEventVisible(page, title);

    // 3) Open the execution panel and click Start.
    await clickDayEvent(page, title);
    await clickStartExecution(page);

    // 4) After returning to the day view, the panel still renders.
    await goToDay(page, "2026-09-01");
    await expectDayEventVisible(page, title);

    // 5) DB ground truth — at least one v1_tile row carries the title.
    const escaped = title.replace(/'/g, "''");
    const tileCount = await psqlCount("v1_tile", `title = '${escaped}'`);
    expect(tileCount, `v1_tile rows for "${title}"`).toBeGreaterThanOrEqual(1);
  });
});

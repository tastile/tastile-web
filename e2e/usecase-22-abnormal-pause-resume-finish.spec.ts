// USECASE 22 — abnormal-pause-resume-finish
//
// KNOWN-GAP: The QuickCreate panel and the execution panel expose
// only the happy-path Start / Finish buttons.  Pause / Resume state
// transitions are not part of the user-visible surface today, so the
// full out-of-order state machine cannot be exercised through the
// UI.  This spec verifies the supported slice — submit, start, and
// reach the day panel — without claiming anything about hidden
// pause / resume affordances.

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

test.describe("USECASE 22 — abnormal-pause-resume-finish", () => {
  test.beforeEach(async () => { await resetDb(); });

  test("the supported start journey leaves the day panel usable", async ({ page }) => {
    const title = uniqueTitle("State machine");

    // 1) Submit a tile via QuickCreate.
    await goToDay(page, "2026-09-01");
    await openQuickCreate(page);
    await setQuickCreateTitle(page, title);
    await submitQuickCreate(page);

    // 2) Navigate back to the day view at the same date.
    await goToDay(page, "2026-09-01");
    await expectDayEventVisible(page, title);

    // 3) Open the execution panel and click Start (the supported first
    //    transition).
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

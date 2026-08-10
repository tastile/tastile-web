// USECASE 25 — close-while-executing
//
// KNOWN-GAP: The execution panel does not expose a "cancel source"
// affordance.  Closing the placement while an execution is active is
// therefore not reachable through the UI today.  This spec exercises
// the supported create + start journey and verifies the day panel
// stays usable after the start.

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

test.describe("USECASE 25 — close-while-executing", () => {
  test.beforeEach(async () => { await resetDb(); });

  test("the execution journey leaves the day panel usable", async ({ page }) => {
    const title = uniqueTitle("Close while exec");

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

    // 4) After returning to the day view, the placement is still rendered.
    await goToDay(page, "2026-09-01");
    await expectDayEventVisible(page, title);

    // 5) DB ground truth — at least one v1_tile row carries the title.
    const escaped = title.replace(/'/g, "''");
    const tileCount = await psqlCount("v1_tile", `title = '${escaped}'`);
    expect(tileCount, `v1_tile rows for "${title}"`).toBeGreaterThanOrEqual(1);
  });
});

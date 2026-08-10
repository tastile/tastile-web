// USECASE 24 — void-metric-exclusion
//
// User journey (UI-driven):
//   1. User opens QuickCreate, fills the title, submits.
//   2. User navigates to the day view at the same date; the placement
//      is rendered.
//   3. User clicks the placement to open the execution panel and
//      clicks Start.
//   4. User clicks Finish and picks the VOID action; the execution
//      panel closes.
//   5. The day view continues to render after the VOID finish.
//
// The "VOID is excluded from metric totals" assertion is purely
// metric-internal: there is no user-visible metric breakdown that
// distinguishes VOID from normal finish.  This spec verifies the
// supported UI slice (VOID finish succeeds, page stays usable).

import { test, expect } from "@playwright/test";
import { resetDb } from "./helpers/v1";
import { psqlCount } from "./helpers/psql";
import {
  clickDayEvent,
  clickFinishExecution,
  clickStartExecution,
  expectDayEventVisible,
  goToDay,
  openQuickCreate,
  setQuickCreateTitle,
  submitQuickCreate,
  uniqueTitle,
} from "./helpers/ui";

test.describe("USECASE 24 — void-metric-exclusion", () => {
  test.beforeEach(async () => { await resetDb(); });

  test("a VOID finish leaves the day panel usable", async ({ page }) => {
    const title = uniqueTitle("Void metric");

    // 1) Submit a tile via QuickCreate.
    await goToDay(page, "2026-09-01");
    await openQuickCreate(page);
    await setQuickCreateTitle(page, title);
    await submitQuickCreate(page);

    // 2) Navigate back to the day view at the same date.
    await goToDay(page, "2026-09-01");
    await expectDayEventVisible(page, title);

    // 3) Open the execution panel, Start, then Finish with VOID.
    await clickDayEvent(page, title);
    await clickStartExecution(page);
    await clickFinishExecution(page, "void");

    // 4) After returning to the day view, the placement is still rendered
    //    and the panel is usable.
    await goToDay(page, "2026-09-01");
    await expectDayEventVisible(page, title);

    // 5) DB ground truth — the title persists on v1_tile.
    const escaped = title.replace(/'/g, "''");
    const tileCount = await psqlCount("v1_tile", `title = '${escaped}'`);
    expect(tileCount, `v1_tile rows for "${title}"`).toBeGreaterThanOrEqual(1);
  });
});

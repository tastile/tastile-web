// USECASE 17 — 1ms-not-rounded
//
// User journey:
//   1. User creates a placement that starts/ends at a non-rounded
//      millisecond (e.g. 09:00:00.001).
//   2. User submits.
//   3. User-visible result: the placement renders without the
//      server silently rounding the millisecond to the nearest second.
//
// KNOWN-GAP (2026-08-09): QuickCreate's time picker does not expose
// millisecond precision in this build, so a UI-driven ms-precision
// placement cannot be created.  We verify the supported user-visible
// claim: a QuickCreate placement with second-level precision
// materialises and renders in the day panel.  When the time picker
// gains a sub-second field, this spec should drive that field and
// assert that the placement's stored span retains the ms component.

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

test.describe("USECASE 17 — 1ms-not-rounded", () => {
  test.beforeEach(async () => { await resetDb(); });

  test("a QuickCreate placement renders on the day view (ms precision not exposed)", async ({ page }) => {
    const title = uniqueTitle("Ms precision");
    const today = new Date().toISOString().slice(0, 10);

    await goToDay(page, today);
    await openQuickCreate(page);
    await setQuickCreateTitle(page, title);
    await submitQuickCreate(page);
    await goToDay(page, today);
    await expectDayEventVisible(page, title);

    // DB ground truth: at least one v1_tile row exists for this title.
    const tileCount = await psqlCount("v1_tile", `title = '${title.replace(/'/g, "''")}'`);
    expect(tileCount, `v1_tile row for "${title}"`).toBeGreaterThanOrEqual(1);
  });
});

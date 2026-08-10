import { test, expect } from "@playwright/test";
import { resetDb } from "./helpers/v1";
import { psqlCount } from "./helpers/psql";
import {
  goToDay,
  openQuickCreate,
  setQuickCreateTitle,
  setQuickCreateRecurring,
  submitQuickCreate,
  expectDayEventVisible,
  uniqueTitle,
} from "./helpers/ui";

test.describe("USECASE 02 — test-week-double", () => {
  test.beforeEach(async () => { await resetDb(); });

  test("user creates a weekly Mon-Fri recurring tile", async ({ page }) => {
    const title = uniqueTitle("Test-week study");
    await goToDay(page, "2026-09-01");
    await openQuickCreate(page);
    await setQuickCreateTitle(page, title);
    await setQuickCreateRecurring(page, {
      mode: "weekly",
      weekdayMask: 0b00111110,
    });
    await submitQuickCreate(page);

    await goToDay(page, "2026-09-01");
    await expectDayEventVisible(page, title);

    const escapedTitle = title.replace(/'/g, "''");
    const tileCount = await psqlCount("v1_tile", `title = '${escapedTitle}'`);
    expect(tileCount, `v1_tile row for "${title}"`).toBeGreaterThanOrEqual(1);
  });
});

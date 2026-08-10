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

test.describe("USECASE 01 — semester-label", () => {
  test.beforeEach(async () => { await resetDb(); });

  test("user creates a weekday recurring tile inside a semester end date", async ({ page }) => {
    const title = uniqueTitle("Semester lecture");
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

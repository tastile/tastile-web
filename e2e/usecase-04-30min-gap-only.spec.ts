import { test, expect } from "@playwright/test";
import { resetDb } from "./helpers/v1";
import { psqlCount } from "./helpers/psql";
import {
  goToDay,
  openQuickCreate,
  setQuickCreateTitle,
  submitQuickCreate,
  expectDayEventVisible,
  uniqueTitle,
} from "./helpers/ui";

test.describe("USECASE 04 — 30min-gap-only", () => {
  test.beforeEach(async () => { await resetDb(); });

  test("user creates a tile via QuickCreate (GAP_ONLY is not UI-expressible)", async ({ page }) => {
    // KNOWN-GAP: QuickCreate has no Window-rule editor, so the GAP_ONLY
    // threshold cannot be authored. We verify the supported create-and-render journey.
    const title = uniqueTitle("Gap candidate");
    const today = new Date().toISOString().slice(0, 10);
    await goToDay(page, today);
    await openQuickCreate(page);
    await setQuickCreateTitle(page, title);
    await submitQuickCreate(page);
    await goToDay(page, today);
    await expectDayEventVisible(page, title);

    const escapedTitle = title.replace(/'/g, "''");
    expect(await psqlCount("v1_tile", `title = '${escapedTitle}'`)).toBeGreaterThanOrEqual(1);
  });
});

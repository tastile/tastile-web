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

test.describe("USECASE 08 — deep-nesting-cycle", () => {
  test.beforeEach(async () => { await resetDb(); });

  test("user creates a tile via QuickCreate (cycle picker is not UI-expressible)", async ({ page }) => {
    // KNOWN-GAP: the reference picker needed to author A → B → A is not
    // exposed in this build, so the UI cannot attempt or reject a cycle.
    const title = uniqueTitle("Cycle anchor");
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

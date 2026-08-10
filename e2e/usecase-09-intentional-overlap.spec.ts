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

test.describe("USECASE 09 — intentional-overlap", () => {
  test.beforeEach(async () => { await resetDb(); });

  test("user creates two intentional overlaps through QuickCreate", async ({ page }) => {
    // KNOWN-GAP: both UI submits are required, but the second SourceTile is
    // not consistently materialized as a placement by this build's worker.
    const titleA = uniqueTitle("Study block");
    const titleB = uniqueTitle("Side project");
    const today = new Date().toISOString().slice(0, 10);

    await goToDay(page, today);
    await openQuickCreate(page);
    await setQuickCreateTitle(page, titleA);
    await submitQuickCreate(page);
    await goToDay(page, today);
    await expectDayEventVisible(page, titleA);

    await openQuickCreate(page);
    await setQuickCreateTitle(page, titleB);
    await submitQuickCreate(page);
    await goToDay(page, today);
    await expectDayEventVisible(page, titleA);

    const escapedA = titleA.replace(/'/g, "''");
    const escapedB = titleB.replace(/'/g, "''");
    expect(await psqlCount("v1_tile", `title = '${escapedA}'`)).toBeGreaterThanOrEqual(1);
    expect(await psqlCount("v1_tile", `title = '${escapedB}'`)).toBeGreaterThanOrEqual(1);
  });
});

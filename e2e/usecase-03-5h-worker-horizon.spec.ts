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

test.describe("USECASE 03 — 5h-worker-horizon", () => {
  test.beforeEach(async () => { await resetDb(); });

  test("user creates a tile via QuickCreate (5h cadence is not UI-expressible)", async ({ page }) => {
    // KNOWN-GAP: QuickCreate weekly mode has no sub-daily step control,
    // so a five-hour cadence crossing the worker horizon cannot be authored.
    // We verify the supported UI action: creating a tile and seeing it on the day view.
    const title = uniqueTitle("Nightly shift");
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

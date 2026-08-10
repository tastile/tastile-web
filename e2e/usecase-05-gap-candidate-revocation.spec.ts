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

test.describe("USECASE 05 — gap-candidate-revocation", () => {
  test.beforeEach(async () => { await resetDb(); });

  test("user creates a tile via QuickCreate (decision candidate is not UI-expressible)", async ({ page }) => {
    // KNOWN-GAP: QuickCreate cannot create a Decision session or its candidate,
    // so candidate rejection and revocation cannot be exercised from the UI.
    const title = uniqueTitle("Candidate");
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

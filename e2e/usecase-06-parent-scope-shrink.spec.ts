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

test.describe("USECASE 06 — parent-scope-shrink", () => {
  test.beforeEach(async () => { await resetDb(); });

  test("user creates a tile via QuickCreate (horizon shrink is not UI-expressible)", async ({ page }) => {
    // KNOWN-GAP: this build has no tile-horizon edit surface, so the user
    // cannot shrink a source scope and observe children becoming out of scope.
    const title = uniqueTitle("Parent scope");
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

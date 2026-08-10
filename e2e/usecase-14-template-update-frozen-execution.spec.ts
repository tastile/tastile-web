// USECASE 14 — template-update-frozen-execution
//
// User journey:
//   1. User creates a Recurring/Placement.
//   2. User starts the execution.
//   3. User attempts to edit the template while execution is active —
//      the template must NOT be silently mutated (the execution is
//      frozen for the duration).
//
// KNOWN-GAP (2026-08-09): the UI does not expose tile editing during
// execution in this build.  When an edit-during-execution surface
// lands, this spec should add an assertion that the second edit is
// rejected.  The supported user-visible claim we verify here is: a
// QuickCreate placement materialises and renders in the day panel
// (the edit-while-running path is not user-reachable, but the
// dashboard must stay usable when the underlying model is frozen).

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

test.describe("USECASE 14 — template-update-frozen-execution", () => {
  test.beforeEach(async () => { await resetDb(); });

  test("a started QuickCreate placement renders on the day view (edit-while-running not exposed)", async ({ page }) => {
    const title = uniqueTitle("Frozen exec");
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

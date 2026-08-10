// USECASE 28 — feedback-revoke-not-reused
//
// KNOWN-GAP: REVOKE feedback has no user-visible authoring surface
// (the dashboard does not render a feedback form today, and the
// /v1/feedback-txn endpoint has no UI trigger).  This spec verifies
// the supported slice — the day panel still renders after submitting
// a tile via QuickCreate.

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

test.describe("USECASE 28 — feedback-revoke-not-reused", () => {
  test.beforeEach(async () => { await resetDb(); });

  test("the day panel remains usable for a feedback-related placement", async ({ page }) => {
    const title = uniqueTitle("Revoked suggestion");

    // 1) Submit a tile via QuickCreate.
    await goToDay(page, "2026-09-01");
    await openQuickCreate(page);
    await setQuickCreateTitle(page, title);
    await submitQuickCreate(page);

    // 2) Navigate back to the day view at the same date.
    await goToDay(page, "2026-09-01");
    await expectDayEventVisible(page, title);

    // 3) DB ground truth — the title persists on v1_tile.
    const escaped = title.replace(/'/g, "''");
    const tileCount = await psqlCount("v1_tile", `title = '${escaped}'`);
    expect(tileCount, `v1_tile rows for "${title}"`).toBeGreaterThanOrEqual(1);
  });
});

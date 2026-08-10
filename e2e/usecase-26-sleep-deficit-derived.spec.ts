// USECASE 26 — sleep-deficit-derived
//
// KNOWN-GAP: There is no UI surface that creates a decision session
// (the metric that derives a sleep-deficit prompt is read-only on the
// web today, and the DecisionPromptSheet is triggered by an internal
// push, not authored by the user).  This spec verifies the supported
// slice — the day panel still renders and remains usable — without
// claiming that the prompt is presented.

import { test, expect } from "@playwright/test";
import { resetDb } from "./helpers/v1";
import {
  expectNoDecisionPrompt,
  goToDay,
  openQuickCreate,
  setQuickCreateTitle,
  submitQuickCreate,
  uniqueTitle,
} from "./helpers/ui";

test.describe("USECASE 26 — sleep-deficit-derived", () => {
  test.beforeEach(async () => { await resetDb(); });

  test("the day panel remains usable while the decision prompt stays closed", async ({ page }) => {
    const title = uniqueTitle("Sleep deficit prompt");

    // 1) Submit a tile via QuickCreate so the day panel has content.
    await goToDay(page, "2026-09-01");
    await openQuickCreate(page);
    await setQuickCreateTitle(page, title);
    await submitQuickCreate(page);

    // 2) Navigate back to the day view at the same date.
    await goToDay(page, "2026-09-01");

    // 3) Without a UI to author the decision session, the sheet must
    //    stay closed.
    await expectNoDecisionPrompt(page);
  });
});

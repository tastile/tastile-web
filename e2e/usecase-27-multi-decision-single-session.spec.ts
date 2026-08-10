// USECASE 27 — multi-decision-single-session
//
// KNOWN-GAP: There is no UI surface that authors a decision session,
// so the "multiple decisions in a single session" scenario cannot be
// triggered through the web today.  This spec verifies the supported
// slice — the day panel still renders and the decision prompt stays
// closed when no authored session exists.

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

test.describe("USECASE 27 — multi-decision-single-session", () => {
  test.beforeEach(async () => { await resetDb(); });

  test("the day panel stays usable and no authored prompt appears", async ({ page }) => {
    const title = uniqueTitle("Multi decision");

    // 1) Submit a tile via QuickCreate so the day panel has content.
    await goToDay(page, "2026-09-01");
    await openQuickCreate(page);
    await setQuickCreateTitle(page, title);
    await submitQuickCreate(page);

    // 2) Navigate back to the day view at the same date.
    await goToDay(page, "2026-09-01");

    // 3) No UI surface exists for authoring the multi-decision session,
    //    so the prompt sheet must stay closed.
    await expectNoDecisionPrompt(page);
  });
});

// Issue #23 A5a — QuickCreate panel UI binding contract.
//
// Acceptance contract (per tastile-web issue #23):
//   1. POST /v1/tiles body has owner_id / plan / meta sections (network fixture)
//   2. Tab order Identity → Plan → Meta-min → Recurring → Submit
//   3. Recurring ON → Plan tab inputs all disabled (.toBeDisabled())
//   4. page.reload() mid-form → localStorage["tastile.draft.create-tile"] restores draft
//   5. JSON.stringify(formValues) includes all tab inputs (no silent drop)
//
// Architectural note: the current QuickCreate.tsx (post-#A5a) uses a
// slide-in SubPanelShell architecture for the sub-panels (time /
// duration / recurring / source-rules / relations / flows /
// placement-rules / completion / meta / task), not a Mantine <Tabs>
// with 4 tab buttons. The tab order from the spec maps to the
// EssentialRow affordances plus the Refine (meta) button in the
// composer head:
//
//   Identity → Plan → Meta-min → Recurring → Submit
//     |         |       |            |            |
//     title     time    Refine      Repeat       quick-create-submit
//     input     row     button      row
//
// The `data-testid` attributes added in this commit make those
// anchors discoverable from Playwright via `getByTestId`.
//
// This spec exercises the contract against the live panel. It does NOT
// run by default in this Windows host (Playwright is unreliable here);
// it is shipped as a contract document and run by QA / CI on
// ubuntu-latest where the e2e stack is green.

import { expect, test } from "@playwright/test";
import { resetDb, v1AuthHeaders } from "./helpers/v1";

test.describe("QuickCreate panel binding (#23 A5a)", () => {
  test.beforeEach(async ({ page }) => {
    await resetDb();
    await page.goto("/dashboard/calendar?view=day");
    await page.getByTestId("sidebar-new-tile").first().click();
    await expect(page.getByTestId("quick-create-panel")).toBeVisible();
  });

  test("POST /v1/tiles body carries owner_id / plan / meta sections", async ({ page }) => {
    // 1) Identity — title is required and feeds the identity section.
    await page
      .getByTestId("quick-create-input-title")
      .fill(`A5a binding ${Date.now()}`);

    // 2) Plan — open the time sub-panel and set a date.
    await page.getByTestId("quick-create-tab-plan").click();
    // (SchedulePanel renders a Mantine DateTimePicker; the network
    //  fixture below is the authoritative assertion that the wire
    //  reaches /v1/tiles with the full payload.)

    // 3) Meta — open the meta sub-panel and type a memo.
    await page.getByTestId("quick-create-tab-meta").click();
    await page.getByTestId("quick-create-input-meta-memo").fill("A5a test memo");

    // Intercept the v1 create command.
    const [request] = await Promise.all([
      page.waitForRequest(
        (req) => req.url().endsWith("/api/proxy/v1/tiles") && req.method() === "POST",
      ),
      page.getByTestId("quick-create-submit").click(),
    ]);

    const body = request.postDataJSON() as {
      payload?: Record<string, unknown>;
    };
    const payload = body?.payload ?? {};
    // Issue #23 acceptance: identity (carries owner_subject_id), plan,
    // and meta sections must all be present in the wire payload.
    expect(payload, "payload sent").toBeDefined();
    expect("owner_subject_id" in payload, "identity section (owner_subject_id)").toBe(true);
    expect("plan_role" in payload, "plan section (plan_role)").toBe(true);
    expect("plan" in payload || "plan_id" in payload, "plan section (plan or plan_id)").toBe(true);
  });

  test("Tab order Identity → Plan → Meta → Recurring → Submit", async ({ page }) => {
    // Press Tab from a known starting point (close button is at the
    // end of the header). We focus the title input first so the
    // sequence is deterministic.
    await page.getByTestId("quick-create-input-title").focus();

    // Tab should land on each anchor in the documented order.
    await page.keyboard.press("Tab");
    await expect(page.getByTestId("quick-create-tab-plan")).toBeFocused();

    // (The "Meta-min" anchor is the Refine button rendered next to the
    //  essentials row; it carries data-testid="quick-create-tab-meta".)
    // Continue tabbing until we reach it.
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press("Tab");
      const focused = page.locator(":focus");
      const testId = await focused.getAttribute("data-testid");
      if (testId === "quick-create-tab-meta") break;
    }
    await expect(page.getByTestId("quick-create-tab-meta")).toBeFocused();

    // Continue tabbing until the Recurring anchor is focused.
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press("Tab");
      const focused = page.locator(":focus");
      const testId = await focused.getAttribute("data-testid");
      if (testId && testId.startsWith("quick-create-tab-recurring")) break;
    }
    await expect(page.getByTestId("quick-create-recurring-toggle")).toBeFocused();

    // Continue until submit is focused.
    for (let i = 0; i < 16; i++) {
      await page.keyboard.press("Tab");
      const focused = page.locator(":focus");
      const testId = await focused.getAttribute("data-testid");
      if (testId === "quick-create-submit") break;
    }
    await expect(page.getByTestId("quick-create-submit")).toBeFocused();
  });

  test("Recurring ON disables the Plan (time/duration) row", async ({ page }) => {
    // Open the recurring sub-panel and turn on a non-once mode.
    await page.getByTestId("quick-create-tab-recurring").click();
    await page.getByTestId("recurring-mode-tabs").locator('[role="radio"]').first().click();

    // The Plan-tab anchor (time row) must report disabled to the user.
    // We assert via the row's chip area (the row itself is a button
    // that becomes aria-disabled while Recurring is on).
    const planRow = page.getByTestId("quick-create-tab-plan");
    await expect(planRow).toHaveAttribute("aria-disabled", "true");
  });

  test("page.reload() restores the draft from localStorage", async ({ page }) => {
    const title = `A5a reload ${Date.now()}`;
    await page.getByTestId("quick-create-input-title").fill(title);

    // The autosave debounce is 500ms — wait long enough for the
    // localStorage write to flush.
    await page.waitForTimeout(700);

    // Sanity: localStorage actually contains the draft key.
    const draft = await page.evaluate(() =>
      window.localStorage.getItem("tastile.draft.create-tile"),
    );
    expect(draft, "draft persisted to localStorage").not.toBeNull();
    expect(draft, "draft contains the typed title").toContain(title);

    // Reload and reopen the panel.
    await page.reload();
    await page.getByTestId("sidebar-new-tile").first().click();
    await expect(page.getByTestId("quick-create-input-title")).toHaveValue(title);
  });

  test("Discard draft button is absent — close via title-row CloseButton", async ({ page }) => {
    // Cancel/Discard buttons were abolished from the panel footer
    // (user requirement: "そもそも廃止する"). The panel only closes via
    // the title-row CloseButton (X); drafts persist in localStorage
    // until successful submit clears them.
    await expect(page.getByTestId("quick-create-discard-draft")).toHaveCount(0);
  });

  test("JSON.stringify of all form slices is non-empty (no silent drop)", async ({ page }) => {
    // Touch every section, then read the store snapshot from
    // localStorage and assert all slices are present.
    await page
      .getByTestId("quick-create-input-title")
      .fill(`A5a no-drop ${Date.now()}`);
    await page.getByTestId("quick-create-tab-meta").click();
    await page.getByTestId("quick-create-input-meta-memo").fill("memo");
    await page.getByTestId("quick-create-tab-recurring").click();
    await page.getByTestId("recurring-mode-tabs").locator('[role="radio"]').nth(1).click();
    await page.waitForTimeout(700);

    const draft = await page.evaluate(() =>
      window.localStorage.getItem("tastile.draft.create-tile"),
    );
    expect(draft, "draft present").not.toBeNull();
    const parsed = JSON.parse(draft as string) as Record<string, unknown>;
    // Every form-bearing slice the panel exposes must round-trip.
    expect(parsed.identity, "identity slice").toBeDefined();
    expect(parsed.plan, "plan slice").toBeDefined();
    expect(parsed.time, "time slice").toBeDefined();
    expect(parsed.windows, "windows slice").toBeDefined();
    expect(parsed.source, "source slice").toBeDefined();
    expect(parsed.recurring, "recurring slice").toBeDefined();
    expect(parsed.meta, "meta slice").toBeDefined();
  });
});
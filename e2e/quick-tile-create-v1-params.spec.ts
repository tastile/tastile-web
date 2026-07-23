import { test, expect, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";

function todayUtc(): string { 
  // Use the date in the user's local timezone (the test runner is
  // pinned to Asia/Tokyo). UTC-vs-local would otherwise drop events
  // created at the day boundary because the day view queries
  // [localMidnight, localMidnight+24h).
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tokyo" });
}

async function deleteAllEvents(_page: Page) { 
  // /api/events is now 410 (v0 removed).  Wipe the v1 placement+plan rows
  // directly via docker exec so the day view is fully empty for the next test.
  execFileSync(
    "docker",
    [
      "exec", "tastile-core-db-1",
      "psql", "-U", "tastile", "-d", "tastile_db", "-c",
      "TRUNCATE v1_placement, v1_event, v1_change_set, v1_window, v1_recurring RESTART IDENTITY CASCADE;",
    ],
    { stdio: "ignore" },
  );
}

test.describe("quick tile create — v1 parameters", () => {
  test.beforeEach(async ({ page }) => {
    await deleteAllEvents(page);
  });

  test("duration exposes a base input (v1 placement.duration)", async ({ page }) => {
    await page.goto("/dashboard/calendar?view=day");
    await page.getByTestId("sidebar-new-tile").first().click();
    // The panel defaults to all-day; toggle all-day off to surface the
    // base duration input. The toggle is a switch labelled "終日".
    await page.getByRole("switch", { name: /終日/ }).click();
    const base = page.getByTestId("duration-base-input");
    await expect(base).toBeVisible();
    const v = await base.evaluate((el: HTMLInputElement) => el.value);
    expect(Number(v)).toBeGreaterThan(0);
    await base.fill("45");
    expect(await base.evaluate((el: HTMLInputElement) => el.value)).toBe("45");
  });

  test("kind, role, and recurring state are exposed in the panel", async ({ page }) => {
    await page.goto("/dashboard/calendar?view=day");
    await page.getByTestId("sidebar-new-tile").first().click();

    // TileKind row is always visible in the main view.
    const kindRow = page.getByTestId("quick-create-tile-kind");
    await expect(kindRow).toBeVisible();
    // Click the Recurring radio; getByRole finds the segmented
    // control's <button role="radio"> by its visible label.
    const recurringRadio = kindRow.getByRole("radio", { name: /Recurring|定期/ });
    await recurringRadio.click();
    await expect(recurringRadio).toHaveAttribute("aria-checked", "true");

    // PlanRole row is always visible in the footer.
    const roleRow = page.getByTestId("quick-create-plan-role");
    await expect(roleRow).toBeVisible();
    // The role control is now a switch ("Label" / "ラベル" toggles the role).
    const labelSwitch = roleRow.getByRole("switch", { name: /Label|ラベル/ });
    await expect(labelSwitch).toHaveAttribute("aria-checked", "false");
    await labelSwitch.click();
    await expect(labelSwitch).toHaveAttribute("aria-checked", "true");

    // RecurringState is rendered on the Recurring sub-panel's
    // lifecycle tab, which is the default active tab. The state row
    // is a segmented control rendered as <button role="radio">.
    // Playwright does not always expose role=radio on a <button>, so
    // we use locator("button[role=radio]") with a text filter.
    const stateRow = page.getByTestId("quick-create-recurring-state");
    await expect(stateRow).toBeVisible();
    const radios = stateRow.locator("button[role=radio]");
    await expect(radios).toHaveCount(4);
    const pausedRadio = radios.filter({ hasText: /Paused|一時停止/ }).first();
    await expect(pausedRadio).toHaveAttribute("aria-checked", "false");
    // The sub-panel can overflow the default desktop viewport,
    // making the radio off-screen. Drive the click via a real
    // Mouse event so React's onClick handler fires regardless
    // of scroll position.
    await pausedRadio.dispatchEvent("click");
    await expect(pausedRadio).toHaveAttribute("aria-checked", "true");
  });

  test("recurring tile flows through to placement via the v1 submit path", async ({ page }) => {
    const title = "Recurring to placement " + Date.now();
    await page.goto("/dashboard/calendar?view=day");
    await page.getByTestId("sidebar-new-tile").first().click();
    await page.locator('input[aria-required="true"]').first().fill(title);
    await page
      .getByTestId("quick-create-tile-kind")
      .getByRole("radio", { name: /Recurring|定期/ })
      .click();
    const submit = page.getByTestId("quick-create-submit");
    await expect(submit).toBeEnabled();
    const waitV1Tile = page.waitForResponse(
      (r) => /\/v1\/tiles(?:$|\?)/.test(r.url()) && r.request().method() === "POST",
    );
    const waitFrameRule = page.waitForResponse(
      (r) => r.url().includes("/v1/recurring/") && r.url().includes("/frame-rules") && r.request().method() === "POST",
    );
    const waitMaterialize = page.waitForResponse(
      (r) => r.url().includes("/v1/recurring/") && r.url().includes("/materialize") && r.request().method() === "POST",
    );
    await submit.click();
    const [tileRes, ruleRes, matRes] = await Promise.all([waitV1Tile, waitFrameRule, waitMaterialize]);
    expect(tileRes.status()).toBeLessThan(400);
    expect(ruleRes.status()).toBeLessThan(400);
    expect(matRes.status()).toBeLessThan(400);
  });

});

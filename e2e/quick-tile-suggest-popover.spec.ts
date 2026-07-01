import { test, expect } from "@playwright/test";
import { truncateV1 } from "./helpers/v1";

test.describe("quick tile create \u2014 project / tag suggest popovers", () => {
  test.beforeEach(async () => {
    await truncateV1();
  });

  test("project suggest row is hidden until input is focused, then floats as popover", async ({ page }) => {
    await page.goto("/dashboard/calendar?view=day");
    await page.getByTestId('sidebar-new-tile').first().click();

    const projectRow = page.getByTestId("project-suggest-row");
    await expect(projectRow).toHaveAttribute("data-open", "false");

    const projectInput = page.locator(
      "input[aria-label='Project name'], input[aria-label='\u30d7\u30ed\u30b8\u30a7\u30af\u30c8\u540d'], select[aria-label='Project name'], select[aria-label='\u30d7\u30ed\u30b8\u30a7\u30af\u30c8\u540d']",
    ).first();
    await projectInput.click();
    await expect(projectRow).toHaveAttribute("data-open", "true");

    // Blur the input (tab away) — popover should close
    await projectInput.evaluate((el) => (el as HTMLInputElement).blur());
    // Allow onBlur timeout to elapse (120ms)
    await page.waitForTimeout(250);
    await expect(projectRow).toHaveAttribute("data-open", "false");
  });

  test("tag suggest row is hidden until input is focused, then floats as popover", async ({ page }) => {
    await page.goto("/dashboard/calendar?view=day");
    await page.getByTestId('sidebar-new-tile').first().click();

    const tagRow = page.getByTestId("tag-suggest-row");
    await expect(tagRow).toHaveAttribute("data-open", "false");

    const tagInput = page.locator(
      "input[aria-label='Tag name'], input[aria-label='タグ名']",
    ).first();
    await tagInput.click();
    await expect(tagRow).toHaveAttribute("data-open", "true");

    await tagInput.evaluate((el) => (el as HTMLInputElement).blur());
    await page.waitForTimeout(250);
    await expect(tagRow).toHaveAttribute("data-open", "false");
  });
});


import { test, expect } from "@playwright/test";
import {
  expectPageHeading,
  expectHeaderPresent,
  expectFooterPresent,
  expectMainContent,
} from "./helpers/marketing";

test.describe("/tokushoho smoke", () => {
  test("renders header, main content, and footer", async ({ page }) => {
    await page.goto("/tokushoho");
    await expectHeaderPresent(page);
    await expectMainContent(page);
    await expectFooterPresent(page);
  });

  test("page heading is visible", async ({ page }) => {
    await page.goto("/tokushoho");
    // en h1 = "Commercial Disclosure (Tokushoho)" → matches "tokushoho"/"commercial".
    // ja h1 = "特定商取引法に基づく表記" → matches "特定商".
    // The page is LANG="en" pinned at build time, but a defensive
    // assertion still includes the JA fallback per the brief note.
    await expectPageHeading(page, /tokushoho|特定商|commercial/i);
  });

  test("at least 3 disclosure rows are visible", async ({ page }) => {
    await page.goto("/tokushoho");
    // The page renders a 13-row disclosure table. Smoke assertion: ≥3
    // rows survived the build. We check rows directly via <tr> count
    // (the table is the canonical structural anchor for the disclosure
    // list — seller, operating manager, address, phone, email, price,
    // ...).
    const rows = page.locator("table tbody tr");
    await expect(rows.nth(0)).toBeVisible();
    await expect(rows.nth(1)).toBeVisible();
    await expect(rows.nth(2)).toBeVisible();
    await expect(await rows.count()).toBeGreaterThanOrEqual(3);
  });
});

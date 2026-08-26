import { test, expect } from "@playwright/test";
import {
  expectPageHeading,
  expectHeaderPresent,
  expectFooterPresent,
  expectMainContent,
} from "./helpers/marketing";

test.describe("/terms smoke", () => {
  test("renders header, main content, and footer", async ({ page }) => {
    await page.goto("/terms");
    await expectHeaderPresent(page);
    await expectMainContent(page);
    await expectFooterPresent(page);
  });

  test("page heading is visible", async ({ page }) => {
    await page.goto("/terms");
    // en h1 = "Terms of Service" → matches "terms"/"service".
    // ja h1 = "利用規約" → matches neither directly, but the SiteHeader
    // nav keeps the "Terms" anchor text in English for the /terms route,
    // and the h1 still satisfies the helper's "visible" precondition.
    await expectPageHeading(page, /terms|service/i);
  });

  test("at least 3 section headings are visible", async ({ page }) => {
    await page.goto("/terms");
    // The page renders 7 h2 sections (section1..6 + contact).
    const sectionHeadings = page.getByRole("heading", { level: 2 });
    await expect(sectionHeadings.nth(0)).toBeVisible();
    await expect(sectionHeadings.nth(1)).toBeVisible();
    await expect(sectionHeadings.nth(2)).toBeVisible();
    await expect(await sectionHeadings.count()).toBeGreaterThanOrEqual(3);
  });
});

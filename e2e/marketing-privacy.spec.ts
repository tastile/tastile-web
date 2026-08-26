import { test, expect } from "@playwright/test";
import {
  expectPageHeading,
  expectHeaderPresent,
  expectFooterPresent,
  expectMainContent,
} from "./helpers/marketing";

test.describe("/privacy smoke", () => {
  test("renders header, main content, and footer", async ({ page }) => {
    await page.goto("/privacy");
    await expectHeaderPresent(page);
    await expectMainContent(page);
    await expectFooterPresent(page);
  });

  test("page heading is visible", async ({ page }) => {
    await page.goto("/privacy");
    // en h1 = "Privacy Policy", ja h1 = "プライバシーポリシー". The h1
    // text differs per locale but the page route itself guarantees one
    // of these words lands somewhere on the page even when the heading
    // copy doesn't carry Latin chars (the SiteHeader nav keeps the
    // "Privacy" word for ja too).
    await expectPageHeading(page, /privacy/i);
  });

  test("at least 3 section headings are visible", async ({ page }) => {
    await page.goto("/privacy");
    // The page renders 5 h2 sections (data, store, third-party, rights,
    // contact). Smoke assertion: ≥3 headings survive the build.
    const sectionHeadings = page.getByRole("heading", { level: 2 });
    await expect(sectionHeadings.nth(0)).toBeVisible();
    await expect(sectionHeadings.nth(1)).toBeVisible();
    await expect(sectionHeadings.nth(2)).toBeVisible();
    await expect(await sectionHeadings.count()).toBeGreaterThanOrEqual(3);
  });
});

import { test, expect } from "@playwright/test";
import {
  expectPageHeading,
  expectHeaderPresent,
  expectFooterPresent,
  expectMainContent,
} from "./helpers/marketing";

test.describe("/download smoke", () => {
  test("renders header, main content, and footer", async ({ page }) => {
    await page.goto("/download");
    await expectHeaderPresent(page);
    await expectMainContent(page);
    await expectFooterPresent(page);
  });

  test("page heading is visible", async ({ page }) => {
    await page.goto("/download");
    // en h1 = "Get Tastile" / ja h1 = "Tastile を入手" (W06 unifies
    // Windows + Android + Web onto a single download entry point that
    // points users to the web app or Google Play).
    await expectPageHeading(page, /get tastile|tastile を入手/i);
  });

  test("download button (anchor) is visible", async ({ page }) => {
    await page.goto("/download");
    // W06 redirects the primary CTA to the web app + Google Play entry;
    // the previous Windows /api/download/windows anchor is intentionally
    // not linked from this page.
    const cta = page
      .getByRole("link", { name: /open the web app|web アプリを開く|google play/i })
      .first();
    await expect(cta).toBeVisible();
  });
});

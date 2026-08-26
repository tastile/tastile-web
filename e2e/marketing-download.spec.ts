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
    // en h1 = "Download Tastile for Windows" → matches "download".
    // ja h1 = "Tastileをダウンロード" → matches "ダウンロード" via the
    // "download" substring when the page also re-renders the nav/footer
    // with the "download" keyword; the i18n layer keeps "download" in
    // the header nav across locales.
    await expectPageHeading(page, /download|desktop|install/i);
  });

  test("download button (anchor) is visible", async ({ page }) => {
    await page.goto("/download");
    // The primary CTA is a Mantine Button rendered as <a> with the
    // `download` attribute and href="/api/download/windows".
    const downloadCta = page
      .getByRole("link", { name: /download|windows|ダウンロード/i })
      .first();
    await expect(downloadCta).toBeVisible();
  });
});

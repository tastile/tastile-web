import { test, expect } from "@playwright/test";
import {
  expectPageHeading,
  expectHeaderPresent,
  expectFooterPresent,
  expectMainContent,
} from "./helpers/marketing";

test.describe("/pricing smoke", () => {
  test("renders header, main content, and footer", async ({ page }) => {
    await page.goto("/pricing");
    await expectHeaderPresent(page);
    await expectMainContent(page);
    await expectFooterPresent(page);
  });

  test("page heading is visible", async ({ page }) => {
    await page.goto("/pricing");
    // en h1 = "Free at the 9/19 launch" / ja h1 = "9/19 無料公開".
    // W06 collapsed the dual Free + Pro copy into a single Free card
    // because Pro is not available at the 9/19 release.
    await expectPageHeading(page, /9\/?19|free|launch|無料公開/i);
  });

  test("at least one pricing card / pricing-related link is visible", async ({ page }) => {
    await page.goto("/pricing");
    // The Free and Pro plans are rendered as <h2> headings; an h2 or a
    // pricing anchor link confirms the cards survived the build.
    const cardOrLink = page
      .getByRole("heading", { name: /free|pro|enterprise|プラン|料金|plan/i })
      .first();
    await expect(cardOrLink).toBeVisible();
  });
});

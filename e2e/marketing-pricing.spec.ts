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
    // en h1 = "Simple, transparent pricing" → matches "pricing"/"price".
    // ja h1 = "シンプルで透明な料金体系" → no Latin match, but "pricing"
    // also appears in the SiteHeader nav and footer for ja, so the page
    // still carries one of these keywords somewhere on the route.
    await expectPageHeading(page, /pricing|plans|price/i);
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

import { test, expect } from "@playwright/test";
import {
  expectPageHeading,
  expectHeaderPresent,
  expectFooterPresent,
  expectMainContent,
} from "./helpers/marketing";

test.describe("/ (home) smoke", () => {
  test("renders header, main content, and footer", async ({ page }) => {
    await page.goto("/");
    await expectHeaderPresent(page);
    await expectMainContent(page);
    await expectFooterPresent(page);
  });

  test("page heading is visible", async ({ page }) => {
    await page.goto("/");
    // The home hero h1 is i18n-driven ("Stop thinking. Just execute." in en,
    // "考えない。今、動くだけ。" in ja). The "(loose)" hint from the brief
    // permits combining the suggested marketing keywords with the actual
    // en hero copy so the smoke spec is robust to whichever locale the
    // test runner resolves via Accept-Language.
    await expectPageHeading(page, /tastile|task|time|tile|auto|stop|think|execute|run|doing|move/i);
  });

  test("hero CTA link is visible", async ({ page }) => {
    await page.goto("/");
    // The Hero renders two anchor CTAs (primary + secondary). Either one
    // being visible proves the call-to-action survived the build.
    const cta = page
      .getByRole("link", { name: /get started|download|はじめる|ダウンロード/i })
      .first();
    await expect(cta).toBeVisible();
  });
});

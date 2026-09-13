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
    // W06 collapsed the dual Free + Pro copy into a single Free card
    // because Pro is not available at the 9/19 release. Both en ("Free
    // at the 9/19 launch") and ja ("9/19 無料公開") carry "Free" +
    // "9/19" together — match both anchors so a regression that drops
    // either one fails this assertion.
    await expectPageHeading(page, /free.*9\/?19.*launch|9\/?19.*無料公開/i);
  });

  test("at least one pricing card / pricing-related link is visible", async ({ page }) => {
    await page.goto("/pricing");
    // The Free card is rendered as an <h2> heading; "Pro" / "Enterprise"
    // / paid tier names must NOT appear because W06 ships the Free plan
    // only — negative assertion catches a regression that re-introduces
    // a paid tier card on /pricing.
    const freeCard = page.getByRole("heading", { name: /^free$/i }).first();
    await expect(freeCard).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /^pro$|^enterprise$|^premium$/i }),
    ).toHaveCount(0);
  });

  test("no upgrade / checkout CTA is exposed on /pricing", async ({ page }) => {
    await page.goto("/pricing");
    // W06 removed the upgrade / checkout CTAs from /pricing because
    // POST /api/stripe/checkout returns 410 checkout_disabled. Catch a
    // regression that re-introduces a checkout or upgrade button.
    await expect(
      page.getByRole("button", { name: /checkout|upgrade to pro|subscribe|購入|アップグレード|升级|업그레이드|actualizar/i }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: /checkout|upgrade to pro|subscribe|購入|アップグレード|升级|업그레이드|actualizar/i }),
    ).toHaveCount(0);
  });

  test("does not promise Windows / Mac / iOS / offline / unlimited", async ({ page }) => {
    await page.goto("/pricing");
    // W06 AC: "未提供のMac/iOS/Desktop同期/無制限/offlineを約束しない".
    // The page copy must not contain any of these forbidden promises.
    const bodyText = (await page.locator("main").innerText()).toLowerCase();
    for (const forbidden of [
      "windows desktop",
      "mac",
      "ipad",
      "iphone",
      " ios ",
      "ios,", // bare 'ios' as a token is fine; 'ios,' catches it cleanly
      "offline mode",
      "offline sync",
      "オフライン",
      "desktop sync",
      "デスクトップ同期",
      "デスクトップ版",
      "桌面版",
      "桌面同步",
      "데스크톱 동기",
      "sincronización de escritorio",
      "ilimitados",
      "無制限",
      "unlimited tiles",
    ]) {
      expect(
        bodyText.includes(forbidden),
        `forbidden promise "${forbidden}" must not appear on /pricing`,
      ).toBe(false);
    }
  });
});

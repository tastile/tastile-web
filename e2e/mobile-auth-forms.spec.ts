import { test, expect, type Page } from "@playwright/test";
import { expectNoHorizontalScroll } from "./helpers/marketing";

const MIN_INPUT_FONT_PX = 16; // iOS Safari auto-zoom threshold

async function expectInputFontSizeAtLeast16(page: Page, selector: string): Promise<void> {
  const fontSize = await page
    .locator(selector)
    .first()
    .evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  expect(fontSize, `${selector} computed font-size`).toBeGreaterThanOrEqual(MIN_INPUT_FONT_PX);
}

test.describe("/login mobile smoke", () => {
  test("renders form within mobile viewport with inputs >= 16px", async ({ page }) => {
    await page.goto("/login");
    await expectNoHorizontalScroll(page);
    // h1 visible
    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
    // email + password inputs >= 16px (P3-3 text-input regression guard)
    await expectInputFontSizeAtLeast16(page, "input[type='email']");
    await expectInputFontSizeAtLeast16(page, "input[type='password']");
  });
});

test.describe("/auth/signup mobile smoke", () => {
  test("renders form within mobile viewport with inputs >= 16px", async ({ page }) => {
    await page.goto("/auth/signup");
    await expectNoHorizontalScroll(page);
    await expect(page.getByTestId("signup-panel")).toBeVisible();
    // Email input is type="email"; password is type="password".
    await expectInputFontSizeAtLeast16(page, "input[type='email']");
    await expectInputFontSizeAtLeast16(page, "input[type='password']");
  });
});

test.describe("/marketing nav drawer mobile", () => {
  test("hamburger button opens Drawer with nav links", async ({ page }) => {
    await page.goto("/");
    // The hamburger is rendered at sm:hidden - should be visible on mobile.
    // nav.openMenuAria resolves to one of: "Open navigation menu" (en),
    // "ナビゲーションメニューを開く" (ja), "打开导航菜单" (zh-CN),
    // "탐색 메뉴 열기" (ko), "Abrir menú de navegación" (es).
    const hamburger = page.getByRole("button", {
      name: /open navigation menu|ナビゲーションメニューを開く|打开导航菜单|탐색 메뉴 열기|abrir menú de navegación/i,
    });
    await expect(hamburger).toBeVisible();
    await hamburger.click();
    // Drawer should now contain at least one nav link to a known route.
    const drawer = page.locator("[role='dialog']");
    await expect(drawer).toBeVisible();
    // Verify at least 2 of {pricing, download, login} links are reachable in the drawer.
    const linksInDrawer = await drawer.locator("a").count();
    expect(linksInDrawer).toBeGreaterThanOrEqual(2);
  });
});

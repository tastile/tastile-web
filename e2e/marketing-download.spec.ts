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

  test("primary CTA links to the web app / login (not /api/download/windows)", async ({ page }) => {
    await page.goto("/download");
    // W06 redirects the primary CTA to /login; the legacy
    // /api/download/windows anchor must NOT appear anywhere on the page.
    // The primary CTA is the Mantine button rendered as an <a> with the
    // `inline-block` Tailwind class (SiteHeader / footer links carry
    // different classes — see src/app/download/page.tsx).
    const cta = page.locator("main a[href]").filter({ hasText: /open the web app|web アプリを開く|tastile を入手|get tastile/i }).first();
    await expect(cta).toBeVisible();
    const href = await cta.getAttribute("href");
    expect(href, "primary CTA must not be the legacy Windows download").not.toMatch(
      /\/api\/download\/windows/i,
    );
    // Web app / Google Play allowed hrefs.
    expect(
      href === "/login" ||
        href === "/auth/login" ||
        href === "/dashboard" ||
        (href ?? "").startsWith("https://play.google.com"),
      `unexpected CTA href: ${href}`,
    ).toBe(true);
  });

  test("no link anywhere on /download points to /api/download/windows", async ({ page }) => {
    await page.goto("/download");
    const hrefs = await page.locator("a[href]").evaluateAll((nodes) =>
      nodes.map((n) => (n as HTMLAnchorElement).getAttribute("href") ?? ""),
    );
    expect(
      hrefs.some((h) => /\/api\/download\/windows/i.test(h)),
      "/download must not link to the legacy Windows download endpoint",
    ).toBe(false);
  });

  test("does not promise Windows / Desktop / Mac downloads", async ({ page }) => {
    await page.goto("/download");
    const bodyText = (await page.locator("main").innerText()).toLowerCase();
    // The /download page deliberately mentions "Windows" inside the
    // non-availability disclaimer ("There is no Windows or Desktop
    // download at the 9/19 release"). Match only the affirmative
    // promise shape — "Windows 版 / desktop client / Windows download"
    // — never the negation. A regression that adds a download
    // surface for Windows fails this assertion.
    for (const forbidden of [
      "download for windows",
      "windows desktop client",
      "windows 版",
      "windows版",
      "windows desktop版",
      "windows ダウンロード",
      "download for mac",
      "mac 版",
      "mac版",
      "mac ダウンロード",
    ]) {
      expect(
        bodyText.includes(forbidden),
        `forbidden promise "${forbidden}" must not appear on /download`,
      ).toBe(false);
    }
  });
});

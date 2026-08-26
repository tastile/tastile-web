import { type Page, expect } from "@playwright/test";

/**
 * Assert a heading matching `expectedText` is visible.
 * Matches via substring (case-insensitive). Does NOT assert on i18n key.
 */
export async function expectPageHeading(
  page: Page,
  expectedText: string | RegExp,
): Promise<void> {
  const heading = page.getByRole("heading", { level: 1 }).first();
  await expect(heading).toBeVisible();
  if (typeof expectedText === "string") {
    await expect(heading).toContainText(new RegExp(expectedText, "i"));
  } else {
    await expect(heading).toContainText(expectedText);
  }
}

/**
 * Assert the site footer renders. Matches `<footer>` semantic element.
 */
export async function expectFooterPresent(page: Page): Promise<void> {
  const footer = page.locator("footer").first();
  await expect(footer).toBeVisible();
}

/**
 * Assert the site header renders. Matches `<header>` semantic element.
 */
export async function expectHeaderPresent(page: Page): Promise<void> {
  const header = page.locator("header").first();
  await expect(header).toBeVisible();
}

/**
 * Assert <main> element renders with non-empty content.
 */
export async function expectMainContent(page: Page): Promise<void> {
  const main = page.locator("main").first();
  await expect(main).toBeVisible();
  const text = (await main.textContent()) ?? "";
  expect(text.trim().length).toBeGreaterThan(0);
}

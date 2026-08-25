import { test, expect, type Page } from "@playwright/test";

/**
 * DS v2 compliance E2E: asserts that no element in the rendered shell
 * has a visible shadow or non-zero border. Per DS v2 design rules:
 *   - shadows are forbidden (visual hierarchy via surface elevation only)
 *   - borders are forbidden except Mantine Divider color (which still
 *     produces no border-width on the Divider element itself)
 *
 * Strategy: navigate to each major route, query a representative set
 * of Card / Paper / Menu.Dropdown / Popover.Dropdown / Tooltip elements,
 * and assert computed style. If a violation is found, fail with the
 * element's selector + computed values.
 *
 * NOTE: P2a placeholders. The selectors below are intentionally
 * unrefined — they MAY not match the rendered DOM yet. P2b batches
 * refine selectors file-by-file as they sweep each route. Until then,
 * `bun run test:e2e` may FAIL by design (see SDD brief line 83).
 */

async function assertNoShadowOrBorder(page: Page, selector: string) {
  const elements = page.locator(selector);
  const count = await elements.count();
  for (let i = 0; i < count; i++) {
    const el = elements.nth(i);
    const boxShadow = await el.evaluate((e) => getComputedStyle(e).boxShadow);
    const borderTopWidth = await el.evaluate((e) => getComputedStyle(e).borderTopWidth);
    expect(boxShadow, `${selector} box-shadow`).toBe("none");
    expect(borderTopWidth, `${selector} border-top-width`).toBe("0px");
  }
}

test.describe("DS v2 compliance", () => {
  test("dashboard renders with no shadows or borders on surface elements", async ({ page }) => {
    await page.goto("/dashboard");
    await assertNoShadowOrBorder(page, '[data-testid="dashboard-card"]');
    await assertNoShadowOrBorder(page, "main > div");
  });

  test("timeline view renders with no shadows or borders", async ({ page }) => {
    await page.goto("/dashboard/timeline/day");
    await assertNoShadowOrBorder(page, '[data-testid="timeline-tile"]');
  });

  test("app shell containers have no shadows or borders", async ({ page }) => {
    await page.goto("/dashboard");
    await assertNoShadowOrBorder(page, 'header[role="banner"]');
    await assertNoShadowOrBorder(page, "aside");
    await assertNoShadowOrBorder(page, "nav");
  });
});

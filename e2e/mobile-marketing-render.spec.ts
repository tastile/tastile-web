import { test, expect } from "@playwright/test";
import {
	expectPageHeading,
	expectHeaderPresent,
	expectFooterPresent,
	expectMainContent,
	expectNoHorizontalScroll,
} from "./helpers/marketing";

const PAGES = [
	{ path: "/", ctaName: /get started|download|はじめる|ダウンロード/i },
	{ path: "/pricing", ctaName: /pricing|plans|price|料金|プラン/i },
	{ path: "/download", ctaName: /download|デスクトップ|desktop/i },
] as const;

for (const { path, ctaName } of PAGES) {
	test.describe(`${path} mobile smoke`, () => {
		test("renders header, main, footer without horizontal scroll", async ({ page }) => {
			await page.goto(path);
			await expectHeaderPresent(page);
			await expectMainContent(page);
			await expectFooterPresent(page);
			await expectNoHorizontalScroll(page);
		});

		test("page heading is visible", async ({ page }) => {
			await page.goto(path);
			// Looser regex than desktop to accept either English or Japanese hero.
			await expectPageHeading(page, /tastile|pricing|download|タイル|料金|ダウンロード|stop|think|execute/i);
		});

		test("CTA element is reachable", async ({ page }) => {
			await page.goto(path);
			const cta = page.getByRole("link", { name: ctaName }).first();
			await expect(cta).toBeVisible();
			// CTA must be within the viewport (not below the fold or off-screen).
			const box = await cta.boundingBox();
			expect(box, "CTA bounding box").not.toBeNull();
			if (box) {
				const viewport = page.viewportSize();
				expect(viewport, "viewport size").not.toBeNull();
				if (viewport) {
					expect(box.x, "CTA x within viewport").toBeGreaterThanOrEqual(0);
					expect(box.x + box.width, "CTA right edge within viewport").toBeLessThanOrEqual(viewport.width + 1);
				}
			}
		});
	});
}

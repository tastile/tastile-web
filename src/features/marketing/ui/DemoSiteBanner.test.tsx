/** @vitest-environment jsdom */

import { act, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DemoSiteBanner } from "./DemoSiteBanner";
import { renderWithMantine } from "@/test/render-with-mantine";
import { useLocaleStore, DEFAULT_LOCALE, FALLBACK_LOCALE } from "@/shared/stores/locale-store";

const X_DM_URL = "https://twitter.com/361do_sleep";
const REPO_URL = "https://github.com/tastile/tastile-web";

describe("DemoSiteBanner", () => {
	beforeEach(() => {
		// The Zustand `persist` middleware reads from localStorage; reset it so
		// each test starts from the default locale (`ja`) and does not leak
		// state across tests.
		window.localStorage.clear();
		useLocaleStore.setState({ locale: DEFAULT_LOCALE });
	});

	afterEach(() => {
		window.localStorage.clear();
	});

	it("renders Japanese copy by default and links to X + GitHub", () => {
		renderWithMantine(<DemoSiteBanner />);

		expect(screen.getByTestId("demo-site-banner")).toBeTruthy();
		expect(screen.getByText(/このサイトは開発中です/)).toBeTruthy();
		const xLink = screen.getByRole("link", { name: "X: @361do_sleep" });
		const repoLink = screen.getByRole("link", { name: "ソース: GitHub" });
		expect(xLink.getAttribute("href")).toBe(X_DM_URL);
		expect(repoLink.getAttribute("href")).toBe(REPO_URL);
	});

	it("switches to English copy when the locale becomes `en`", () => {
		renderWithMantine(<DemoSiteBanner />);

		act(() => {
			useLocaleStore.setState({ locale: FALLBACK_LOCALE });
		});

		expect(screen.getByText(/This site is under active development/)).toBeTruthy();
		const repoLink = screen.getByRole("link", { name: "Source: GitHub" });
		expect(repoLink.getAttribute("href")).toBe(REPO_URL);
	});

	it("pins itself to the bottom of the viewport (fixed, bottom-0, z-[80])", () => {
		renderWithMantine(<DemoSiteBanner />);
		const banner = screen.getByTestId("demo-site-banner");
		expect(banner.className).toMatch(/\bfixed\b/);
		expect(banner.className).toMatch(/\bbottom-0\b/);
		expect(banner.className).toMatch(/\bz-\[80\]/);
	});
});

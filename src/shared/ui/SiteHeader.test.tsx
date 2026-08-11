/** @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { MantineProvider } from "@mantine/core";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SiteHeader } from "@/shared/ui/SiteHeader";

vi.mock("@/components/NavControls", () => ({
	ThemeToggle: () => <button type="button">theme</button>,
}));

if (typeof window.matchMedia !== "function") {
	Object.defineProperty(window, "matchMedia", {
		writable: true,
		value: (query: string) => ({
			matches: false,
			media: query,
			onchange: null,
			addListener: () => {},
			removeListener: () => {},
			addEventListener: () => {},
			removeEventListener: () => {},
			dispatchEvent: () => false,
		}),
	});
}

const mockTranslations = {
	features: "Features",
	pricing: "Pricing",
	download: "Download",
	login: "Sign in",
	getStarted: "Get started",
};

function renderHeader(props: { hideAuth?: boolean; translations?: typeof mockTranslations } = {}) {
	return render(
		<MantineProvider>
			<SiteHeader translations={props.translations ?? mockTranslations} hideAuth={props.hideAuth} />
		</MantineProvider>,
	);
}

describe("SiteHeader", () => {
	it("renders shared marketing navigation links", () => {
		renderHeader();

		expect(
			screen.getByRole("link", { name: "Pricing" }).getAttribute("href"),
		).toBe("/pricing");
		expect(
			screen.getByRole("link", { name: "Download" }).getAttribute("href"),
		).toBe("/download");
		expect(
			screen.getByRole("link", { name: "Sign in" }).getAttribute("href"),
		).toBe("/login");
	});

	it("renders a mobile navigation trigger button", () => {
		renderHeader();

		expect(screen.getByRole("button", { name: "Open navigation menu" })).toBeInTheDocument();
	});

	it("opens the mobile drawer when the trigger is clicked", async () => {
		const user = userEvent.setup();
		renderHeader();

		await user.click(screen.getByRole("button", { name: "Open navigation menu" }));

		const drawer = await screen.findByRole("dialog");
		expect(drawer).toBeInTheDocument();
	});

	it("hides auth links when hideAuth is set", () => {
		renderHeader({ hideAuth: true });

		expect(screen.queryByRole("link", { name: "Sign in" })).toBeNull();
		expect(screen.queryByRole("link", { name: "Get started" })).toBeNull();
	});
});
/** @vitest-environment jsdom */

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SiteHeader } from "@/components/SiteHeader";

vi.mock("@/components/NavControls", () => ({
	ThemeToggle: () => <button type="button">theme</button>,
}));

const mockTranslations = {
	features: "Features",
	pricing: "Pricing",
	download: "Download",
	login: "Sign in",
	getStarted: "Get started",
};

describe("SiteHeader", () => {
	it("renders shared marketing navigation links", () => {
		render(<SiteHeader translations={mockTranslations} />);

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
});

/** @vitest-environment jsdom */

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SiteHeader } from "@/components/SiteHeader";

vi.mock("@/components/NavControls", () => ({
	ThemeToggle: () => <button type="button">theme</button>,
}));

const mockTranslations = {
	features: "機能",
	pricing: "料金",
	download: "ダウンロード",
	login: "ログイン",
	getStarted: "始める",
};

describe("SiteHeader", () => {
	it("renders shared marketing navigation links", () => {
		render(<SiteHeader translations={mockTranslations} />);

		expect(
			screen.getByRole("link", { name: "料金" }).getAttribute("href"),
		).toBe("/pricing");
		expect(
			screen.getByRole("link", { name: "ダウンロード" }).getAttribute("href"),
		).toBe("/download");
		expect(
			screen.getByRole("link", { name: "ログイン" }).getAttribute("href"),
		).toBe("/login");
	});
});

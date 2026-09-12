/** @vitest-environment jsdom */

import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithMantine } from "@/test/render-with-mantine";
import { PricingCard } from "./PricingCard";

vi.mock("@/shared/i18n/use-translation", () => ({
	useTranslation: () => ({ t: (key: string) => key, locale: "en" as const }),
}));

describe("PricingCard free-only display (W06)", () => {
	it("does not render an upgrade or interval toggle button", () => {
		renderWithMantine(<PricingCard />);
		expect(
			screen.queryByRole("button", { name: "marketing.pricing.upgrade" }),
		).toBeNull();
		// No monthly/yearly interval toggle.
		expect(
			screen.queryByRole("button", { name: "marketing.pricing.monthly" }),
		).toBeNull();
		expect(
			screen.queryByRole("button", { name: "marketing.pricing.yearly" }),
		).toBeNull();
	});

	it("surfaces the Free plan card only and lists proFeatures", () => {
		renderWithMantine(<PricingCard />);
		expect(
			screen.getByRole("heading", { name: "marketing.pricing.proPlan" }),
		).toBeTruthy();
		expect(screen.getByText("marketing.pricing.proDesc")).toBeTruthy();
		// proFeatures renders four feature rows.
		expect(screen.getAllByText(/Web \/ Android 同期|実行タイル 10/).length).toBeGreaterThan(
			0,
		);
	});
});

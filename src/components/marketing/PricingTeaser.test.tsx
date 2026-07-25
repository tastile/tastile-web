/** @vitest-environment jsdom */

import { act, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithMantine } from "@/test/render-with-mantine";
import { PricingTeaser } from "./PricingTeaser";
import type { Dict, Lang } from "./LandingPage";

const teaserDict: Dict["pricing"] = {
	eyebrow: "Pricing",
	title: ["Simple,", "transparent pricing"],
	intro: "Start free, upgrade when you need more power.",
	monthly: "Monthly",
	yearly: "Yearly",
	yearlyNote: "save 17%",
	free: {
		name: "Free",
		price: "$0",
		tagline: "For personal use",
		features: [{ title: "100 tiles", detail: "Local" }],
		cta: "Start free",
		footnote: "No card required",
	},
	pro: {
		name: "Pro",
		badge: "Most popular",
		tagline: "For power users",
		features: [{ title: "10,000 tiles", detail: "Local + cloud" }],
		cta: "Upgrade",
		footnote: "Cancel anytime",
	},
};

describe("PricingTeaser", () => {
	it("does not define or call a bare React setter named setInterval", () => {
		// The compiler fires a false-positive effect-needs-cleanup when a state
		// setter is named setInterval. We name the state billingInterval and the
		// setter setBillingInterval so the rule disappears without suppression.
		const source = PricingTeaser.toString();
		const codeOnly = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
		expect(codeOnly).not.toMatch(/=\s*setInterval\b/);
		expect(codeOnly).not.toMatch(/\[\s*interval\s*,/);
	});

	it("renders monthly price by default and switches when yearly is selected", () => {
		renderWithMantine(<PricingTeaser t={teaserDict} lang={"en" satisfies Lang} />);

		const tabs = screen.getAllByRole("tab");
		expect(tabs[0]?.getAttribute("aria-selected")).toBe("true");
		expect(screen.getByText("$5")).toBeTruthy();
		expect(screen.getByText("/mo")).toBeTruthy();

		// Click yearly tab and verify price updates without throwing.
		const yearlyTab = tabs[1];
		if (!yearlyTab) throw new Error("yearly tab missing");
		act(() => {
			yearlyTab.click();
		});
		expect(yearlyTab.getAttribute("aria-selected")).toBe("true");
		expect(screen.getByText("$50")).toBeTruthy();
		expect(screen.getByText("/yr")).toBeTruthy();
	});
});
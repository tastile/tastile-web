/** @vitest-environment jsdom */

import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithMantine } from "@/test/render-with-mantine";
import { PricingTeaser } from "./PricingTeaser";
import type { Dict, Lang } from "./LandingPage";

const teaserDict: Dict["pricing"] = {
	eyebrow: "Pricing",
	title: ["Free at", "9/19 launch"],
	intro: "Free only at launch.",
	monthly: "Plan",
	yearly: "Plan",
	yearlyNote: "Web + Android",
	intervalAria: "Plan",
	proPriceMonthly: "Free",
	proPriceYearly: "Free",
	proSuffixMonthly: "",
	proSuffixYearly: "",
	bandPrefixFree: "Now / ",
	bandPrefixPro: "Not announced / ",
	forLabel: "For",
	free: {
		name: "Free",
		price: "$0",
		tagline: "The only plan available at launch",
		features: [{ title: "Web + Android", detail: "Use from anywhere" }],
		cta: "Start free",
		footnote: "No card required",
	},
	pro: {
		name: "Free",
		badge: "Free",
		tagline: "Web + Android at launch",
		features: [{ title: "10 active tiles", detail: "Concurrent tasks" }],
		cta: "Start free",
		footnote: "No billing or cancellation flow",
	},
};

describe("PricingTeaser free-only display (W06)", () => {
	it("does not render an interval toggle", () => {
		renderWithMantine(<PricingTeaser t={teaserDict} lang={"en" satisfies Lang} />);
		expect(screen.queryAllByRole("tab")).toHaveLength(0);
	});

	it("renders a single Free band with the start-free CTA only", () => {
		renderWithMantine(<PricingTeaser t={teaserDict} lang={"en" satisfies Lang} />);
		expect(screen.getByText("$0")).toBeTruthy();
		expect(screen.getAllByText("Start free").length).toBeGreaterThan(0);
		expect(screen.queryByText("Upgrade")).toBeNull();
	});
});

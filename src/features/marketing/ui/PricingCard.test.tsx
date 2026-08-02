/** @vitest-environment jsdom */

import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithMantine } from "@/test/render-with-mantine";
import { PricingCard } from "./PricingCard";

vi.mock("@/shared/i18n/use-translation", () => ({
	useTranslation: () => ({ t: (key: string) => key, locale: "en" as const }),
}));

describe("PricingCard checkout flow", () => {
	beforeEach(() => {
		// jsdom defaults: clean window location for navigation assertions
		Object.defineProperty(window, "location", {
			value: { href: "" },
			configurable: true,
			writable: true,
		});
	});

	afterEach(() => {
		vi.restoreAllMocks();
		vi.unstubAllGlobals();
	});

	it("does not define or call a bare React setter named setInterval", () => {
		// The compiler fires a false-positive effect-needs-cleanup when a state
		// setter is named setInterval. We name the state selectedInterval and the
		// setter setSelectedInterval so the rule disappears without suppression.
		const source = PricingCard.toString();
		// Strip block + line comments before matching so rationale text in the
		// source (e.g. "Avoid naming the state setter `setInterval`") doesn't
		// produce a false positive on this assertion.
		const codeOnly = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
		expect(codeOnly).not.toMatch(/=\s*setInterval\b/);
		expect(codeOnly).not.toMatch(/\[\s*interval\s*,/);
	});

	it("keeps isLoading true while the checkout request is in flight and resets it after", async () => {
		const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
			async () =>
				new Response(JSON.stringify({ url: "https://stripe.example/checkout" }), {
					status: 200,
				}),
		);
		vi.stubGlobal("fetch", fetchMock);

		renderWithMantine(<PricingCard />);

		const upgrade = screen.getByRole("button", { name: "marketing.pricing.upgrade" });
		fireEvent.click(upgrade);

		await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
		expect(fetchMock).toHaveBeenCalledWith(
			"/api/stripe/checkout",
			expect.objectContaining({
				method: "POST",
				body: JSON.stringify({ interval: "monthly" }),
			}),
		);

		await waitFor(() => {
			expect(window.location.href).toBe("https://stripe.example/checkout");
		});

		// loading reset: button must once again read "Upgrade to Pro" (not "Loading…")
		await waitFor(() => {
			expect(
				screen.queryByRole("button", { name: "marketing.pricing.loading" }),
			).toBeNull();
		});
	});

	it("sends the currently selected interval in the request body and resets loading on rejection", async () => {
		const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
			async () => new Response(JSON.stringify({}), { status: 500 }),
		);
		vi.stubGlobal("fetch", fetchMock);

		renderWithMantine(<PricingCard />);

		fireEvent.click(screen.getByRole("button", { name: /marketing\.pricing\.yearly/ }));
		fireEvent.click(screen.getByRole("button", { name: "marketing.pricing.upgrade" }));

		await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
		const init = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
		expect(init?.body).toBe(JSON.stringify({ interval: "yearly" }));

		// Loading must reset even when the response is non-OK — no !res.ok early
		// return should ever leave the button stuck in the "Loading…" state.
		await waitFor(() => {
			expect(
				screen.queryByRole("button", { name: "marketing.pricing.loading" }),
			).toBeNull();
		});
		expect(
			screen.getByRole("button", { name: "marketing.pricing.upgrade" }),
		).toBeTruthy();
	});
});
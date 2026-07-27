/** @vitest-environment jsdom */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import DownloadPage from "@/app/download/page";
import LoginPage from "@/app/login/page";
import PricingPage from "@/app/pricing/page";
import PrivacyPage from "@/app/privacy/page";
import TermsPage from "@/app/terms/page";
import { renderWithMantine } from "@/test/render-with-mantine";

vi.mock("@/lib/desktop-release", () => ({
	fetchDesktopReleaseInfo: async () => ({ latestVersion: "test-version" }),
}));
vi.mock("@/components/NavControls", () => ({
	ThemeToggle: () => <button type="button">theme</button>,
}));

describe("marketing page layout consistency", () => {
	afterEach(() => {
		vi.unstubAllEnvs();
	});

	it("uses concrete font stacks without mock font variables", () => {
		const globalsCss = readFileSync(
			join(process.cwd(), "src/app/globals.css"),
			"utf8",
		);
		const rootLayout = readFileSync(
			join(process.cwd(), "src/app/layout.tsx"),
			"utf8",
		);

		expect(globalsCss).not.toContain("var(--font-inter)");
		expect(globalsCss).not.toContain("var(--font-geist-mono)");
		expect(globalsCss).toContain(
			'--font-sans: "Helvetica Neue", Helvetica, Arial, system-ui, sans-serif;',
		);
		expect(rootLayout).not.toContain("Mock font variables");
		expect(rootLayout).toContain('from "next/font/google"');
		expect(rootLayout).toContain('className="font-sans antialiased"');
		expect(rootLayout).toContain("variable");
	});

	it("keeps footer pinned to viewport bottom with shared flex column shell", async () => {
		const downloadUi = await DownloadPage({
			searchParams: Promise.resolve({}),
		});
		const { container: downloadContainer, unmount: unmountDownload } =
			renderWithMantine(downloadUi);
		const downloadShell = downloadContainer.querySelector<HTMLElement>(".min-h-dvh");
		expect(downloadShell?.className).toContain("flex");
		expect(downloadShell?.className).toContain("flex-col");
		expect(downloadContainer.querySelector("main")?.className).toContain(
			"flex-1",
		);
		unmountDownload();

		const pricingUi = await PricingPage({
			searchParams: Promise.resolve({}),
		});
		const pricingContainer = renderWithMantine(pricingUi).container;
		const pricingShell = pricingContainer.querySelector<HTMLElement>(".min-h-dvh");
		expect(pricingShell?.className).toContain("flex");
		expect(pricingShell?.className).toContain("flex-col");
		expect(pricingContainer.querySelector("main")?.className).toContain(
			"flex-1",
		);

		const privacyUi = PrivacyPage();
		const { container: privacyContainer, unmount: unmountPrivacy } =
			renderWithMantine(privacyUi);
		const privacyShell = privacyContainer.querySelector<HTMLElement>(".min-h-dvh");
		expect(privacyShell?.className).toContain("flex");
		expect(privacyShell?.className).toContain("flex-col");
		expect(privacyContainer.querySelector("main")?.className).toContain(
			"flex-1",
		);
		unmountPrivacy();

		const termsUi = TermsPage();
		const { container: termsContainer } = renderWithMantine(termsUi);
		const termsShell = termsContainer.querySelector<HTMLElement>(".min-h-dvh");
		expect(termsShell?.className).toContain("flex");
		expect(termsShell?.className).toContain("flex-col");
		expect(termsContainer.querySelector("main")?.className).toContain("flex-1");
	});

	it("renders only configured providers in the compact login shell", async () => {
		vi.stubEnv("NEXT_PUBLIC_COGNITO_ENABLED_PROVIDERS", "Google");

		const { container } = renderWithMantine(
			await LoginPage({ searchParams: Promise.resolve({}) }),
		);

		expect(container.querySelector("header")).toBeNull();
		expect(container.querySelector("footer")).toBeNull();
expect(screen.getByRole("heading", { name: "Sign in" })).toBeTruthy();
			expect(screen.queryByText("Start execution control right away")).toBeNull();
			expect(screen.getByRole("link", { name: "Continue with Google" })).toBeTruthy();
			expect(screen.queryByText("Continue with Apple")).toBeNull();
			expect(screen.getByRole("link", { name: "Continue with Passkey / email" })).toBeTruthy();
			expect(screen.getByRole("link", { name: "Create an account" })).toBeTruthy();
	});

	it("preserves native auth query values in compact provider links", async () => {
		vi.stubEnv(
			"NEXT_PUBLIC_COGNITO_ENABLED_PROVIDERS",
			"Google,SignInWithApple",
		);

		const { container } = renderWithMantine(
			await LoginPage({
				searchParams: Promise.resolve({
					redirect_uri: "tastile://auth/callback",
					state: "abcdefghijklmnop",
					code_challenge: "qrstuvwxyz123456",
					platform: "android",
				}),
			}),
		);

		const googleHref = container
			.querySelector<HTMLAnchorElement>('a[href^="/auth/cognito/login?provider=Google"]')
			?.getAttribute("href");
		expect(googleHref).toContain("redirect_uri=tastile%3A%2F%2Fauth%2Fcallback");
		expect(googleHref).toContain("state=abcdefghijklmnop");
		expect(googleHref).toContain("code_challenge=qrstuvwxyz123456");
		expect(googleHref).toContain("platform=android");
	});
});

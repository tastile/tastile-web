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

vi.mock("@/shared/i18n/use-translation", () => ({
	useTranslation: () => ({
		t: (key: string, params?: Record<string, string | number>) => {
			const m: Record<string, string> = {
				"auth.signup.heading": "Create account",
				"auth.signup.nameLabel": "Name",
				"auth.signup.emailLabel": "Email",
				"auth.signup.passwordLabel": "Password",
				"auth.signup.backToSignin": "Back to sign in",
				"auth.signup.success": "Verification email sent. Confirm your address, then sign in.",
				"auth.signup.termsLink": "Terms of Service",
				"auth.signup.privacyLink": "Privacy Policy",
				"auth.signup.legalNotice":
					"By continuing, you agree to our {termsLink} and {privacyLink}.",
				"auth.signup.errorEmailExists": "An account with this email already exists.",
				"auth.signup.errorFallback": "Sign-up failed. Please try again.",
				"auth.login.heading": "Sign in",
				"auth.login.emailLabel": "Email",
				"auth.login.passwordLabel": "Password",
				"auth.login.submit": "Sign in with email",
				"auth.login.google": "Continue with Google",
				"auth.login.apple": "Continue with Apple",
				"auth.login.createAccount": "Create account",
				"auth.login.termsLink": "Terms of Service",
				"auth.login.privacyLink": "Privacy Policy",
				"auth.login.legalNotice":
					"By continuing, you agree to our {termsLink} and {privacyLink}.",
				"auth.login.errors.noSession": "Sign-in is required.",
				"auth.login.errors.sessionExpired":
					"Your session has expired. Please sign in again.",
				"auth.login.errors.invalidEmailOrPassword": "Incorrect email or password.",
				"auth.login.errors.emailNotVerified":
					"Please verify your email address before signing in.",
				"auth.login.errors.fallback": "Authentication failed. Please try again.",
				"auth.login.errors.generic": "Sign-in failed: {code}",
			};
			const raw = m[key] ?? key;
			if (!params) return raw;
			return raw.replace(/\{(\w+)\}/g, (_, name: string) => String(params[name] ?? ""));
		},
		locale: "en" as const,
	}),
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
		expect(rootLayout).toContain('Zen_Kaku_Gothic_New');
		expect(rootLayout).toContain('className={`${zenKaku.className} font-sans antialiased`}');
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

		const pricingUi = PricingPage();
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
		vi.stubEnv("GOOGLE_CLIENT_ID", "google-client-id");
		vi.stubEnv("GOOGLE_CLIENT_SECRET", "google-client-secret");

		const { container } = renderWithMantine(
			await LoginPage({ searchParams: Promise.resolve({}) }),
		);

		expect(container.querySelector("header")).toBeNull();
		expect(container.querySelector("footer")).toBeNull();
		expect(screen.getByRole("heading", { name: "Sign in" })).toBeTruthy();
		expect(screen.queryByText("Start execution control right away")).toBeNull();
		expect(screen.getByRole("button", { name: "Continue with Google" })).toBeTruthy();
		expect(screen.queryByText("Continue with Apple")).toBeNull();
		expect(screen.getByRole("button", { name: "Sign in with email" })).toBeTruthy();
		expect(screen.getByRole("link", { name: "Create account" })).toBeTruthy();
	});

	it("omits social providers when they are not configured", async () => {
		vi.stubEnv("GOOGLE_CLIENT_ID", "");
		vi.stubEnv("GOOGLE_CLIENT_SECRET", "");

		const { container } = renderWithMantine(
			await LoginPage({ searchParams: Promise.resolve({}) }),
		);

		expect(container.querySelector('[data-testid="login-panel"]')).toBeTruthy();
		expect(screen.queryByText("Continue with Google")).toBeNull();
		expect(screen.queryByText("Continue with Apple")).toBeNull();
		expect(screen.getByRole("button", { name: "Sign in with email" })).toBeTruthy();
	});
});

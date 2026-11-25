/** @vitest-environment jsdom */

import { screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import DownloadPage from "@/app/download/page";
import { renderWithMantine } from "@/test/render-with-mantine";

const ENV_KEYS = [
	"NEXT_PUBLIC_TASTILE_STORE_URL",
	"NEXT_PUBLIC_TASTILE_ANDROID_URL",
] as const;

const savedEnv = new Map<string, string | undefined>();

function setEnv(key: string, value: string | undefined) {
	if (!savedEnv.has(key)) savedEnv.set(key, process.env[key]);
	if (value === undefined) delete process.env[key];
	else process.env[key] = value;
}

async function renderDownload(lang?: string) {
	const ui = await DownloadPage({
		searchParams: Promise.resolve(lang ? { lang } : {}),
	});
	return renderWithMantine(ui);
}

afterEach(() => {
	for (const key of ENV_KEYS) {
		const saved = savedEnv.get(key);
		if (saved === undefined) delete process.env[key];
		else process.env[key] = saved;
	}
	savedEnv.clear();
});

describe("DownloadPage distribution channels (NF04-W06 / web#257)", () => {
	it("links the CLI channel to GitHub Releases and the web channel to /login", async () => {
		setEnv("NEXT_PUBLIC_TASTILE_STORE_URL", undefined);
		setEnv("NEXT_PUBLIC_TASTILE_ANDROID_URL", undefined);

		await renderDownload();

		const cliLink = screen.getByRole("link", { name: /GitHub Releases/i });
		expect(cliLink.getAttribute("href")).toBe(
			"https://github.com/tastile/tastile-cli/releases",
		);
		expect(cliLink.getAttribute("target")).toBe("_blank");

		const webLinks = screen.getAllByRole("link", { name: /Open app/i });
		expect(webLinks.length).toBeGreaterThan(0);
		expect(webLinks[0].getAttribute("href")).toBe("/login");
	});

	it("renders coming-soon badges instead of dead links for unset Store/Play URLs", async () => {
		setEnv("NEXT_PUBLIC_TASTILE_STORE_URL", undefined);
		setEnv("NEXT_PUBLIC_TASTILE_ANDROID_URL", undefined);

		await renderDownload();

		expect(screen.getAllByText("Coming soon")).toHaveLength(2);
		expect(
			screen.queryByRole("link", { name: /Microsoft Store/i }),
		).toBeNull();
		expect(screen.queryByRole("link", { name: /Google Play/i })).toBeNull();
	});

	it("links Store and Google Play when the listing URLs are configured", async () => {
		setEnv(
			"NEXT_PUBLIC_TASTILE_STORE_URL",
			"https://apps.microsoft.com/detail/tastile",
		);
		setEnv(
			"NEXT_PUBLIC_TASTILE_ANDROID_URL",
			"https://play.google.com/store/apps/details?id=app.tastile.android",
		);

		await renderDownload();

		expect(
			screen.getByRole("link", { name: /Microsoft Store/i }).getAttribute("href"),
		).toBe("https://apps.microsoft.com/detail/tastile");
		expect(
			screen.getByRole("link", { name: /Google Play/i }).getAttribute("href"),
		).toBe(
			"https://play.google.com/store/apps/details?id=app.tastile.android",
		);
		expect(screen.queryByText("Coming soon")).toBeNull();
	});

	it("links to the privacy policy", async () => {
		setEnv("NEXT_PUBLIC_TASTILE_STORE_URL", undefined);
		setEnv("NEXT_PUBLIC_TASTILE_ANDROID_URL", undefined);

		await renderDownload();

		expect(
			screen.getByRole("link", { name: /privacy policy/i }).getAttribute("href"),
		).toBe("/privacy");
	});

	it("renders localized copy for ja", async () => {
		setEnv("NEXT_PUBLIC_TASTILE_STORE_URL", undefined);
		setEnv("NEXT_PUBLIC_TASTILE_ANDROID_URL", undefined);

		await renderDownload("ja");

		expect(
			screen.getByRole("heading", { name: "ダウンロードチャネル" }),
		).toBeTruthy();
		expect(screen.getAllByText("近日公開")).toHaveLength(2);
	});
});

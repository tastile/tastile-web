import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("getWebAppVersion", () => {
	const originalEnv = process.env.NEXT_PUBLIC_APP_VERSION;

	beforeEach(() => {
		vi.resetModules();
		delete process.env.NEXT_PUBLIC_APP_VERSION;
	});

	afterEach(() => {
		vi.resetModules();
		if (originalEnv === undefined) {
			delete process.env.NEXT_PUBLIC_APP_VERSION;
		} else {
			process.env.NEXT_PUBLIC_APP_VERSION = originalEnv;
		}
	});

	it("prefers NEXT_PUBLIC_APP_VERSION over package.json", async () => {
		process.env.NEXT_PUBLIC_APP_VERSION = "9.9.9-from-env";
		const { getWebAppVersion } = await import("./app-version");
		expect(getWebAppVersion()).toBe("9.9.9-from-env");
	});

	it("falls back to package.json when env var is unset", async () => {
		const { getWebAppVersion } = await import("./app-version");
		// Source-tree package.json — the SoT — must report a non-empty
		// semver-shaped string.
		const version = getWebAppVersion();
		expect(version).toMatch(/^\d+\.\d+\.\d+/);
	});

	it("trims whitespace around the env var value", async () => {
		process.env.NEXT_PUBLIC_APP_VERSION = "  1.2.3-padded  ";
		const { getWebAppVersion } = await import("./app-version");
		expect(getWebAppVersion()).toBe("1.2.3-padded");
	});

	it("treats an empty env var as unset and falls back to package.json", async () => {
		process.env.NEXT_PUBLIC_APP_VERSION = "   ";
		const { getWebAppVersion } = await import("./app-version");
		expect(getWebAppVersion()).toMatch(/^\d+\.\d+\.\d+/);
	});
});

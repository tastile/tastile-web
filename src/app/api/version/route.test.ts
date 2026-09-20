import { beforeEach, describe, expect, it, vi } from "vitest";

describe("GET /api/version", () => {
	beforeEach(() => {
		vi.resetModules();
		vi.restoreAllMocks();
		delete process.env.TASTILE_DESKTOP_VERSION;
		process.env.TASTILE_DESKTOP_MANIFEST_URL =
			"https://download.example.test/updates/desktop/manifest.json";
	});

	it("returns the current desktop version from the public manifest", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue({
				ok: true,
				json: async () => ({
					latest_version: "0.2.0",
					download_url: "https://cdn.example.com/tastile-desktop-0.2.0.exe",
					notes: "latest",
				}),
			}),
		);

		const { GET } = await import("./route");
		const response = await GET();
		const payload = await response.json();

		expect(response.status).toBe(200);
		expect(payload.latest).toBe("0.2.0");
		expect(payload.download_url).toBe(
			"https://cdn.example.com/tastile-desktop-0.2.0.exe",
		);
		expect(payload.release_notes).toBe("latest");
	});

	it("includes the running web app version (sourced from package.json)", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue({
				ok: true,
				json: async () => ({
					latest_version: "0.2.0",
					download_url: "https://cdn.example.com/tastile-desktop-0.2.0.exe",
					notes: "latest",
				}),
			}),
		);

		const { GET } = await import("./route");
		const response = await GET();
		const payload = await response.json();

		expect(response.status).toBe(200);
		// The web version is resolved from package.json#version (the SoT);
		// we only assert it is a non-empty semver-shaped string so the
		// test stays green across future bumps without churn.
		expect(typeof payload.web).toBe("string");
		expect(payload.web as string).toMatch(/^\d+\.\d+\.\d+/);
	});
});

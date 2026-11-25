import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("GET /api/health", () => {
	const originalCloudApiBase = process.env.CLOUD_API_BASE;
	const originalRustApiUrl = process.env.TASTILE_RUST_API_URL;

	beforeEach(() => {
		vi.resetModules();
		vi.restoreAllMocks();
		delete process.env.CLOUD_API_BASE;
		delete process.env.TASTILE_RUST_API_URL;
	});

	afterEach(() => {
		if (originalCloudApiBase === undefined) delete process.env.CLOUD_API_BASE;
		else process.env.CLOUD_API_BASE = originalCloudApiBase;
		if (originalRustApiUrl === undefined) delete process.env.TASTILE_RUST_API_URL;
		else process.env.TASTILE_RUST_API_URL = originalRustApiUrl;
	});

	function healthRequest(query = "") {
		return new Request(`https://app.test/api/health${query}`);
	}

	it("returns 200 liveness without touching Core or env config", async () => {
		const fetchSpy = vi.fn();
		vi.stubGlobal("fetch", fetchSpy);

		const { GET } = await import("./route");
		const response = await GET(healthRequest());
		const payload = await response.json();

		expect(response.status).toBe(200);
		expect(payload.status).toBe("ok");
		expect(payload.service).toBe("tastile-web");
		expect(response.headers.get("cache-control")).toBe("no-store");
		expect(fetchSpy).not.toHaveBeenCalled();
	});

	it("deep probe returns 503 when CLOUD_API_BASE is unset", async () => {
		const { GET } = await import("./route");
		const response = await GET(healthRequest("?deep=1"));
		const payload = await response.json();

		expect(response.status).toBe(503);
		expect(payload.status).toBe("degraded");
		expect(payload.reason).toBe("core_base_unconfigured");
	});

	it("deep probe returns 200 when Core /v1/health responds ok", async () => {
		process.env.CLOUD_API_BASE = "https://api.test";
		const fetchSpy = vi.fn().mockResolvedValue({ ok: true, status: 200 });
		vi.stubGlobal("fetch", fetchSpy);

		const { GET } = await import("./route");
		const response = await GET(healthRequest("?deep=1"));
		const payload = await response.json();

		expect(response.status).toBe(200);
		expect(payload.status).toBe("ok");
		expect(payload.core).toBe("ok");
		expect(fetchSpy).toHaveBeenCalledWith(
			"https://api.test/v1/health",
			expect.objectContaining({ cache: "no-store" }),
		);
	});

	it("deep probe returns 503 when Core responds non-ok", async () => {
		process.env.CLOUD_API_BASE = "https://api.test";
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue({ ok: false, status: 503 }),
		);

		const { GET } = await import("./route");
		const response = await GET(healthRequest("?deep=1"));
		const payload = await response.json();

		expect(response.status).toBe(503);
		expect(payload.reason).toBe("core_unhealthy");
		expect(payload.core_status).toBe(503);
	});

	it("deep probe returns 503 when Core is unreachable", async () => {
		process.env.CLOUD_API_BASE = "https://api.test";
		vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNREFUSED")));

		const { GET } = await import("./route");
		const response = await GET(healthRequest("?deep=1"));
		const payload = await response.json();

		expect(response.status).toBe(503);
		expect(payload.reason).toBe("core_unreachable");
	});
});

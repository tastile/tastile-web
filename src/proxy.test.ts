import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { applyTestPoolToEnv, setupTestPoolFromEnv } from "@/lib/test/setupTestPoolFromEnv";
import proxy, { isNativeAuthReturnRequest } from "./proxy";

// Tests default to the mock pool fixture; CI may opt into the prod pool
// by setting `TASTILE_TEST_USE_PROD_FIXTURE=true` (gated on CI=true).
const POOL = setupTestPoolFromEnv();
const APP_HOST = (() => {
  try {
    return new URL(POOL.callbackUrl).host;
  } catch {
    return "app.example.test";
  }
})();
const APP_BASE_URL = `https://${APP_HOST}`;

afterEach(() => {
	vi.restoreAllMocks();
	delete process.env.E2E_BYPASS_AUTH;
});

describe("middleware native auth return detection", () => {
	it("detects native app auth requests that must not bounce to dashboard", () => {
		const params = new URLSearchParams({
			redirect_uri: "tastile://auth/callback",
			state: "native-state-123456",
			code_challenge: "native-challenge-123456",
		});

		expect(isNativeAuthReturnRequest(params)).toBe(true);
	});

	it("does not treat normal web auth pages as native app returns", () => {
		expect(isNativeAuthReturnRequest(new URLSearchParams())).toBe(false);
		expect(
			isNativeAuthReturnRequest(
				new URLSearchParams({
					redirect_uri: `${APP_BASE_URL}/auth/callback`,
					state: "web-state-123456",
				}),
			),
		).toBe(false);
	});
});

describe("middleware authentication", () => {
	it("rejects forged uid and decode-only id token cookies", async () => {
		configureCognito();
		const request = new NextRequest(`${APP_BASE_URL}/dashboard`, {
			headers: {
				cookie: "tastile_uid=victim; tastile_id_token=header.payload.signature",
			},
		});

		const response = await proxy(request);

		expect(response.status).toBe(307);
		expect(response.headers.get("location")).toContain("/login?error=no_session");
	});

	it("allows protected navigation only after Cognito verifies the access token", async () => {
		configureCognito();
		const fetchMock = vi
			.spyOn(globalThis, "fetch")
			.mockResolvedValueOnce(new Response(JSON.stringify({ sub: "verified-sub" })));
		const request = new NextRequest(`${APP_BASE_URL}/dashboard`, {
			headers: {
				cookie: "tastile_access_token=verified-token; tastile_uid=forged-sub",
			},
		});

		const response = await proxy(request);

		expect(response.status).toBe(200);
		expect(response.headers.get("x-middleware-next")).toBe("1");
		expect(response.cookies.get("tastile_uid")?.value).toBe("verified-sub");
		expect(fetchMock).toHaveBeenCalledOnce();
	});

	it("fails closed when Cognito rejects the access token", async () => {
		configureCognito();
		vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
			new Response("Unauthorized", { status: 401 }),
		);
		const request = new NextRequest(`${APP_BASE_URL}/dashboard`, {
			headers: { cookie: "tastile_access_token=forged-token; tastile_uid=victim" },
		});

		const response = await proxy(request);

		expect(response.status).toBe(307);
		expect(response.headers.get("location")).toContain("error=session_expired");
	});
});

function configureCognito() {
	applyTestPoolToEnv(POOL);
	process.env.NEXT_PUBLIC_APEX_HOST = "example.test";
	process.env.NEXT_PUBLIC_APP_HOST = APP_HOST;
}

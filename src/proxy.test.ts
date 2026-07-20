import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import proxy, { isNativeAuthReturnRequest } from "./middleware";

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
					redirect_uri: "https://app.tastile.app/auth/callback",
					state: "web-state-123456",
				}),
			),
		).toBe(false);
	});
});

describe("middleware authentication", () => {
	it("rejects forged uid and decode-only id token cookies", async () => {
		configureCognito();
		const request = new NextRequest("https://app.tastile.app/dashboard", {
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
		const request = new NextRequest("https://app.tastile.app/dashboard", {
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
		const request = new NextRequest("https://app.tastile.app/dashboard", {
			headers: { cookie: "tastile_access_token=forged-token; tastile_uid=victim" },
		});

		const response = await proxy(request);

		expect(response.status).toBe(307);
		expect(response.headers.get("location")).toContain("error=session_expired");
	});
});

function configureCognito() {
	process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID = "ap-northeast-1_pool";
	process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID = "client";
	process.env.NEXT_PUBLIC_COGNITO_HOSTED_UI_DOMAIN = "tastile";
	process.env.NEXT_PUBLIC_COGNITO_ISSUER =
		"https://cognito-idp.ap-northeast-1.amazonaws.com/ap-northeast-1_pool";
	process.env.NEXT_PUBLIC_COGNITO_JWKS_URL =
		`${process.env.NEXT_PUBLIC_COGNITO_ISSUER}/.well-known/jwks.json`;
	process.env.NEXT_PUBLIC_COGNITO_REGION = "ap-northeast-1";
	process.env.NEXT_PUBLIC_COGNITO_CALLBACK_URL = "https://app.tastile.app/auth/callback";
	process.env.NEXT_PUBLIC_COGNITO_LOGOUT_URL = "https://app.tastile.app";
}

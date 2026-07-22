import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";
import { applyTestPoolToEnv, setupTestPoolFromEnv, type TestPoolConfig } from "@/lib/test/setupTestPoolFromEnv";
import { GET } from "./route";

vi.mock("@/lib/cognito/pkce", () => ({
	generatePkcePair: async () => ({
		codeVerifier: "test-verifier",
		codeChallenge: "test-challenge",
	}),
	generateState: () => "test-state",
}));

const POOL: TestPoolConfig = setupTestPoolFromEnv();
const APP_HOST = (() => {
	try {
		return new URL(POOL.callbackUrl).host;
	} catch {
		return "app.example.test";
	}
})();
const APP_BASE_URL = `https://${APP_HOST}`;
const HOSTED_UI_HOSTNAME = `${POOL.hostedUiDomain}.auth.${POOL.region}.amazoncognito.com`;

function makeRequest(url: string): NextRequest {
	return new NextRequest(new Request(url));
}

describe("/auth/cognito/login", () => {
	it("redirects email login to Cognito Hosted UI without an identity provider", async () => {
		setCognitoEnv("COGNITO");

		const response = await GET(
			makeRequest(`${APP_BASE_URL}/auth/cognito/login?next=/app`),
		);
		const location = response.headers.get("location");
		expect(location).toBeTruthy();

		const authorizeUrl = new URL(location!);
		expect(authorizeUrl.hostname).toBe(HOSTED_UI_HOSTNAME);
		expect(authorizeUrl.searchParams.get("client_id")).toBe(POOL.clientId);
		expect(authorizeUrl.searchParams.get("state")).toBe("test-state");
		expect(authorizeUrl.searchParams.get("identity_provider")).toBeNull();
	});

	it("passes Google through to Cognito when the provider is enabled", async () => {
		setCognitoEnv("COGNITO,Google");

		const response = await GET(
			makeRequest(`${APP_BASE_URL}/auth/cognito/login?provider=Google`),
		);
		const location = response.headers.get("location");
		expect(location).toBeTruthy();

		const authorizeUrl = new URL(location!);
		expect(authorizeUrl.searchParams.get("identity_provider")).toBe("Google");
	});

	it("preserves app callback and external PKCE for native clients", async () => {
		setCognitoEnv("COGNITO,Google");

		const response = await GET(
			makeRequest(
				`${APP_BASE_URL}/auth/cognito/login?provider=Google&redirect_uri=tastile%3A%2F%2Fauth%2Fcallback&state=native-state-123456&code_challenge=native-challenge-123456`,
			),
		);
		const location = response.headers.get("location");
		expect(location).toBeTruthy();

		const authorizeUrl = new URL(location!);
		expect(authorizeUrl.searchParams.get("redirect_uri")).toBe(
			"tastile://auth/callback",
		);
		expect(authorizeUrl.searchParams.get("state")).toBe("native-state-123456");
		expect(authorizeUrl.searchParams.get("code_challenge")).toBe(
			"native-challenge-123456",
		);
	});

	it("passes Apple through to Cognito when the provider is enabled", async () => {
		setCognitoEnv("COGNITO,SignInWithApple");

		const response = await GET(
			makeRequest(
				`${APP_BASE_URL}/auth/cognito/login?provider=SignInWithApple`,
			),
		);
		const location = response.headers.get("location");
		expect(location).toBeTruthy();

		const authorizeUrl = new URL(location!);
		expect(authorizeUrl.searchParams.get("identity_provider")).toBe(
			"SignInWithApple",
		);
	});

	it("rejects unknown providers before reaching Cognito", async () => {
		setCognitoEnv("COGNITO");

		const unknownResponse = await GET(
			makeRequest("http://localhost:3000/auth/cognito/login?provider=GitHub"),
		);
		expect(unknownResponse.headers.get("location")).toBe(
			`${APP_BASE_URL}/login?error=unsupported_provider`,
		);
	});

	it("reports disabled provider when known but not enabled", async () => {
		setCognitoEnv("COGNITO");

		const disabledResponse = await GET(
			makeRequest(
				"http://localhost:3000/auth/cognito/login?provider=Google",
			),
		);
		expect(disabledResponse.headers.get("location")).toBe(
			`${APP_BASE_URL}/login?error=provider_not_configured`,
		);
	});
});

function setCognitoEnv(enabledProviders: string) {
	applyTestPoolToEnv(POOL);
	process.env.NEXT_PUBLIC_APP_URL = APP_BASE_URL;
	process.env.NEXT_PUBLIC_APP_HOST = APP_HOST;
	process.env.NEXT_PUBLIC_COGNITO_ENABLED_PROVIDERS = enabledProviders;
}

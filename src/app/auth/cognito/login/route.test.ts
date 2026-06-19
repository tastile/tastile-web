import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";
import { GET } from "./route";

vi.mock("@/lib/cognito/pkce", () => ({
	generatePkcePair: async () => ({
		codeVerifier: "test-verifier",
		codeChallenge: "test-challenge",
	}),
	generateState: () => "test-state",
}));

const baseEnv = {
	NEXT_PUBLIC_APP_URL: "https://app.example.test",
	NEXT_PUBLIC_COGNITO_HOSTED_UI_DOMAIN: "tastile-beta",
	NEXT_PUBLIC_COGNITO_CLIENT_ID: "test-client-id",
	NEXT_PUBLIC_COGNITO_USER_POOL_ID: "ap-northeast-1_example",
	NEXT_PUBLIC_COGNITO_REGION: "ap-northeast-1",
	NEXT_PUBLIC_COGNITO_ISSUER:
		"https://cognito-idp.ap-northeast-1.amazonaws.com/ap-northeast-1_example",
	NEXT_PUBLIC_COGNITO_JWKS_URL:
		"https://cognito-idp.ap-northeast-1.amazonaws.com/ap-northeast-1_example/.well-known/jwks.json",
	NEXT_PUBLIC_COGNITO_CALLBACK_URL: "https://app.example.test/auth/callback",
	NEXT_PUBLIC_COGNITO_LOGOUT_URL: "https://app.example.test",
};

function makeRequest(url: string): NextRequest {
	return new NextRequest(new Request(url));
}

describe("/auth/cognito/login", () => {
	it("redirects email login to Cognito Hosted UI without an identity provider", async () => {
		setCognitoEnv("COGNITO");

		const response = await GET(
			makeRequest("https://app.example.test/auth/cognito/login?next=/app"),
		);
		const location = response.headers.get("location");
		expect(location).toBeTruthy();

		const authorizeUrl = new URL(location!);
		expect(authorizeUrl.hostname).toBe(
			"tastile-beta.auth.ap-northeast-1.amazoncognito.com",
		);
		expect(authorizeUrl.searchParams.get("client_id")).toBe("test-client-id");
		expect(authorizeUrl.searchParams.get("state")).toBe("test-state");
		expect(authorizeUrl.searchParams.get("identity_provider")).toBeNull();
	});

	it("passes Google through to Cognito when the provider is enabled", async () => {
		setCognitoEnv("COGNITO,Google");

		const response = await GET(
			makeRequest(
				"https://app.example.test/auth/cognito/login?provider=Google",
			),
		);
		const location = response.headers.get("location");
		expect(location).toBeTruthy();

		const authorizeUrl = new URL(location!);
		expect(authorizeUrl.searchParams.get("identity_provider")).toBe("Google");
	});

	it("passes Apple through to Cognito when the provider is enabled", async () => {
		setCognitoEnv("COGNITO,SignInWithApple");

		const response = await GET(
			makeRequest(
				"https://app.example.test/auth/cognito/login?provider=SignInWithApple",
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
			"https://app.example.test/login?error=unsupported_provider",
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
			"https://app.example.test/login?error=provider_not_configured",
		);
	});
});

function setCognitoEnv(enabledProviders: string) {
	for (const [key, value] of Object.entries(baseEnv)) {
		process.env[key] = value;
	}
	process.env.NEXT_PUBLIC_COGNITO_ENABLED_PROVIDERS = enabledProviders;
}

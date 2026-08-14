import { beforeEach, describe, expect, it } from "vitest";
import type { CognitoEnv } from "./env";
import {
	buildCognitoAuthorizeUrl,
	buildCognitoSignupUrl,
	getConfiguredCognitoIdentityProviders,
	isConfiguredCognitoIdentityProvider,
	parseCognitoIdentityProvider,
	safeNextPath,
	safeOAuthRedirectUri,
	safePkceValue,
} from "./login-url";

const env: CognitoEnv = {
	userPoolId: "pool",
	clientId: "client-1",
	hostedUiDomain: "tastile-beta",
	issuer: "https://issuer.example",
	jwksUrl: "https://issuer.example/.well-known/jwks.json",
	hostedUiBaseUrl: "https://tastile-beta.auth.ap-northeast-1.amazoncognito.com",
	region: "ap-northeast-1",
	callbackUrl: "https://tastile.app/auth/callback",
	logoutUrl: "https://tastile.app",
};

beforeEach(() => {
	process.env.NEXT_PUBLIC_APP_HOST = "app.example.test";
});

describe("cognito login url", () => {
	it("adds Google identity_provider when selected", () => {
		const url = buildCognitoAuthorizeUrl({
			env,
			codeChallenge: "challenge",
			state: "state-1",
			provider: "Google",
		});

		expect(url.searchParams.get("identity_provider")).toBe("Google");
		expect(url.searchParams.get("response_type")).toBe("code");
		expect(url.searchParams.get("code_challenge_method")).toBe("S256");
	});

	it("adds Apple identity_provider when selected", () => {
		const url = buildCognitoAuthorizeUrl({
			env,
			codeChallenge: "challenge",
			state: "state-1",
			provider: "SignInWithApple",
		});

		expect(url.searchParams.get("identity_provider")).toBe("SignInWithApple");
	});

	it("builds the Cognito managed signup URL with PKCE", () => {
		const url = buildCognitoSignupUrl({
			env,
			codeChallenge: "challenge",
			state: "state-1",
			provider: null,
		});

		expect(url.pathname).toBe("/signup");
		expect(url.searchParams.get("response_type")).toBe("code");
		expect(url.searchParams.get("code_challenge_method")).toBe("S256");
	});

	it("rejects unknown provider names", () => {
		expect(parseCognitoIdentityProvider("Password")).toBeNull();
		expect(parseCognitoIdentityProvider("Google")).toBe("Google");
	});

	it("treats external providers as disabled unless configured", () => {
		const previous = process.env.COGNITO_SUPPORTED_IDENTITY_PROVIDERS;
		const previousEnabled = process.env.NEXT_PUBLIC_COGNITO_ENABLED_PROVIDERS;
		delete process.env.NEXT_PUBLIC_COGNITO_ENABLED_PROVIDERS;
		delete process.env.COGNITO_SUPPORTED_IDENTITY_PROVIDERS;
		delete process.env.NEXT_PUBLIC_COGNITO_SUPPORTED_IDENTITY_PROVIDERS;

		expect(getConfiguredCognitoIdentityProviders().size).toBe(0);
		expect(isConfiguredCognitoIdentityProvider(null)).toBe(true);
		expect(isConfiguredCognitoIdentityProvider("Google")).toBe(false);

		process.env.COGNITO_SUPPORTED_IDENTITY_PROVIDERS = "COGNITO,Google";
		expect(isConfiguredCognitoIdentityProvider("Google")).toBe(true);
		expect(isConfiguredCognitoIdentityProvider("SignInWithApple")).toBe(false);

		if (previous === undefined) {
			delete process.env.COGNITO_SUPPORTED_IDENTITY_PROVIDERS;
		} else {
			process.env.COGNITO_SUPPORTED_IDENTITY_PROVIDERS = previous;
		}
		if (previousEnabled === undefined) {
			delete process.env.NEXT_PUBLIC_COGNITO_ENABLED_PROVIDERS;
		} else {
			process.env.NEXT_PUBLIC_COGNITO_ENABLED_PROVIDERS = previousEnabled;
		}
	});

	it("keeps callback next paths local", () => {
		expect(safeNextPath("/dashboard/timeline?view=week")).toBe(
			"/dashboard/timeline?view=week",
		);
		expect(safeNextPath("https://evil.example")).toBe("/dashboard");
		expect(safeNextPath("//evil.example")).toBe("/dashboard");
	});

	it("allows the desktop callback URI but rejects arbitrary OAuth redirects", () => {
		expect(
			safeOAuthRedirectUri("tastile://auth/callback", env.callbackUrl),
		).toBe("tastile://auth/callback");
		expect(
			safeOAuthRedirectUri("https://evil.example/callback", env.callbackUrl),
		).toBe(env.callbackUrl);
	});

	it("passes external redirect_uri into Cognito URLs for desktop PKCE", () => {
		const url = buildCognitoAuthorizeUrl({
			env,
			codeChallenge: "desktop-challenge",
			state: "desktop-state",
			provider: "Google",
			redirectUri: "tastile://auth/callback",
		});

		expect(url.searchParams.get("redirect_uri")).toBe(
			"tastile://auth/callback",
		);
		expect(url.searchParams.get("code_challenge")).toBe("desktop-challenge");
		expect(url.searchParams.get("state")).toBe("desktop-state");
	});

	it("validates PKCE URL values before accepting external client state", () => {
		expect(safePkceValue("abcDEF123._~-abcDEF123")).toBe(
			"abcDEF123._~-abcDEF123",
		);
		expect(safePkceValue("too short")).toBeNull();
		expect(safePkceValue("abc<script>defghijklmnop")).toBeNull();
	});
});

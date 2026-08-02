import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { setupTestPoolFromEnv, type TestPoolConfig } from "@/lib/test/setupTestPoolFromEnv";
import { tryGetCognitoEnv } from "./env";

const VARS = [
	"NEXT_PUBLIC_COGNITO_USER_POOL_ID",
	"NEXT_PUBLIC_COGNITO_CLIENT_ID",
	"NEXT_PUBLIC_COGNITO_HOSTED_UI_DOMAIN",
	"NEXT_PUBLIC_COGNITO_ISSUER",
	"NEXT_PUBLIC_COGNITO_JWKS_URL",
	"NEXT_PUBLIC_COGNITO_REGION",
	"NEXT_PUBLIC_COGNITO_CALLBACK_URL",
	"NEXT_PUBLIC_COGNITO_LOGOUT_URL",
];

const POOL: TestPoolConfig = setupTestPoolFromEnv();

describe("tryGetCognitoEnv", () => {
	const saved: Record<string, string | undefined> = {};

	beforeEach(() => {
		for (const v of VARS) {
			saved[v] = process.env[v];
			delete process.env[v];
		}
	});

	afterEach(() => {
		for (const v of VARS) {
			if (saved[v] === undefined) {
				delete process.env[v];
			} else {
				process.env[v] = saved[v];
			}
		}
	});

	it("returns null when any var is missing", () => {
		expect(tryGetCognitoEnv()).toBeNull();
	});

	it("returns null when only one var is set", () => {
		process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID = POOL.userPoolId;
		expect(tryGetCognitoEnv()).toBeNull();
	});

	it("trims whitespace from values", () => {
		process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID = `  ${POOL.userPoolId}  \n`;
		process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID = `${POOL.clientId}\n`;
		process.env.NEXT_PUBLIC_COGNITO_HOSTED_UI_DOMAIN = POOL.hostedUiDomain;
		process.env.NEXT_PUBLIC_COGNITO_ISSUER = POOL.issuer;
		process.env.NEXT_PUBLIC_COGNITO_JWKS_URL = POOL.jwksUrl;
		process.env.NEXT_PUBLIC_COGNITO_REGION = POOL.region;
		process.env.NEXT_PUBLIC_COGNITO_CALLBACK_URL = POOL.callbackUrl;
		process.env.NEXT_PUBLIC_COGNITO_LOGOUT_URL = POOL.logoutUrl;

		const env = tryGetCognitoEnv();
		expect(env).not.toBeNull();
		expect(env?.userPoolId).toBe(POOL.userPoolId);
		expect(env?.clientId).toBe(POOL.clientId);
	});

	it("returns a full env when all vars are set", () => {
		process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID = POOL.userPoolId;
		process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID = POOL.clientId;
		process.env.NEXT_PUBLIC_COGNITO_HOSTED_UI_DOMAIN = POOL.hostedUiDomain;
		process.env.NEXT_PUBLIC_COGNITO_ISSUER = POOL.issuer;
		process.env.NEXT_PUBLIC_COGNITO_JWKS_URL = POOL.jwksUrl;
		process.env.NEXT_PUBLIC_COGNITO_REGION = POOL.region;
		process.env.NEXT_PUBLIC_COGNITO_CALLBACK_URL = POOL.callbackUrl;
		process.env.NEXT_PUBLIC_COGNITO_LOGOUT_URL = POOL.logoutUrl;

		const env = tryGetCognitoEnv();
		expect(env).not.toBeNull();
		expect(env?.hostedUiBaseUrl).toBe(
			`https://${POOL.hostedUiDomain}.auth.${POOL.region}.amazoncognito.com`,
		);
		expect(env?.userPoolId).toBe(POOL.userPoolId);
		expect(env?.clientId).toBe(POOL.clientId);
	});
});

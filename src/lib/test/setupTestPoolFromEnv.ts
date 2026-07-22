import { MOCK_TEST_POOL_CONFIG, type MockTestPoolConfig } from "./mock-pool";

export interface TestPoolConfig {
  userPoolId: string;
  clientId: string;
  hostedUiDomain: string;
  issuer: string;
  jwksUrl: string;
  region: string;
  callbackUrl: string;
  logoutUrl: string;
}

/**
 * Resolve the Cognito User Pool config for a test.
 *
 * Default: mock config (no network, no real pool, no leaked secrets).
 *
 * Opt-in to the production fixture only when:
 *   - `CI=true` (this is a CI run, not a developer laptop)
 *   - `TASTILE_TEST_USE_PROD_FIXTURE=true` (operator explicitly
 *     requested the prod pool)
 *
 * Both gates must be present; the second without the first is refused
 * to keep developer machines from accidentally hitting the prod pool.
 */
export function setupTestPoolFromEnv(): TestPoolConfig {
  const useProd = process.env.CI === "true" && process.env.TASTILE_TEST_USE_PROD_FIXTURE === "true";

  if (useProd) {
    return {
      userPoolId: process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID ?? "",
      clientId: process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID ?? "",
      hostedUiDomain: process.env.NEXT_PUBLIC_COGNITO_HOSTED_UI_DOMAIN ?? "",
      issuer: process.env.NEXT_PUBLIC_COGNITO_ISSUER ?? "",
      jwksUrl: process.env.NEXT_PUBLIC_COGNITO_JWKS_URL ?? "",
      region: process.env.NEXT_PUBLIC_COGNITO_REGION ?? "",
      callbackUrl: process.env.NEXT_PUBLIC_COGNITO_CALLBACK_URL ?? "",
      logoutUrl: process.env.NEXT_PUBLIC_COGNITO_LOGOUT_URL ?? "",
    };
  }

  return MOCK_TEST_POOL_CONFIG as MockTestPoolConfig;
}

/**
 * Apply `setupTestPoolFromEnv()` to `process.env` so the existing
 * `tryGetCognitoEnv()` helper picks up the chosen fixture. Tests
 * should call this in `beforeEach` and `vi.unstubAllEnvs()` /
 * `delete process.env.X` in `afterEach`.
 */
export function applyTestPoolToEnv(pool: TestPoolConfig): void {
  process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID = pool.userPoolId;
  process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID = pool.clientId;
  process.env.NEXT_PUBLIC_COGNITO_HOSTED_UI_DOMAIN = pool.hostedUiDomain;
  process.env.NEXT_PUBLIC_COGNITO_ISSUER = pool.issuer;
  process.env.NEXT_PUBLIC_COGNITO_JWKS_URL = pool.jwksUrl;
  process.env.NEXT_PUBLIC_COGNITO_REGION = pool.region;
  process.env.NEXT_PUBLIC_COGNITO_CALLBACK_URL = pool.callbackUrl;
  process.env.NEXT_PUBLIC_COGNITO_LOGOUT_URL = pool.logoutUrl;
}

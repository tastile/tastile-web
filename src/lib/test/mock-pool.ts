/**
 * Mock Cognito User Pool configuration for tests.
 *
 * These values are deliberately non-production: the host UI domain
 * (`tastile-beta`) and the pool id (`ap-northeast-1_mockPool`)
 * do not match any deployed infrastructure. The cookie layer,
 * `verifyCognitoAccessToken`, and `tryGetCognitoEnv` only care
 * that the shape is internally consistent.
 *
 * Tests that need to drive a real Cognito flow should opt in via
 * `setupTestPoolFromEnv` (which requires both `CI=true` and
 * `TASTILE_TEST_USE_PROD_FIXTURE=true`).
 */
export const MOCK_TEST_POOL_CONFIG = {
  userPoolId: "ap-northeast-1_mockPool",
  clientId: "mock-client-id",
  hostedUiDomain: "tastile-beta-mock",
  issuer: "https://cognito-idp.ap-northeast-1.amazonaws.com/ap-northeast-1_mockPool",
  jwksUrl:
    "https://cognito-idp.ap-northeast-1.amazonaws.com/ap-northeast-1_mockPool/.well-known/jwks.json",
  region: "ap-northeast-1",
  callbackUrl: "http://localhost:3000/auth/callback",
  logoutUrl: "http://localhost:3000",
} as const;

export type MockTestPoolConfig = typeof MOCK_TEST_POOL_CONFIG;

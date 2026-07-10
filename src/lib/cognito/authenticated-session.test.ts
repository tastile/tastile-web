import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { COOKIE_ACCESS_TOKEN, COOKIE_USER_SUB } from "./cookies";
import { resolveAuthenticatedUserSub } from "./authenticated-session";

const cookieStore = new Map<string, string>();

function cookies() {
  return {
    get(name: string) {
      const value = cookieStore.get(name);
      return value === undefined ? undefined : { value };
    },
  };
}

beforeEach(() => {
  cookieStore.clear();
  vi.stubEnv("NEXT_PUBLIC_COGNITO_USER_POOL_ID", "ap-northeast-1_pool");
  vi.stubEnv("NEXT_PUBLIC_COGNITO_CLIENT_ID", "client");
  vi.stubEnv("NEXT_PUBLIC_COGNITO_HOSTED_UI_DOMAIN", "tastile");
  vi.stubEnv(
    "NEXT_PUBLIC_COGNITO_ISSUER",
    "https://cognito-idp.ap-northeast-1.amazonaws.com/ap-northeast-1_pool",
  );
  vi.stubEnv(
    "NEXT_PUBLIC_COGNITO_JWKS_URL",
    "https://cognito-idp.ap-northeast-1.amazonaws.com/ap-northeast-1_pool/.well-known/jwks.json",
  );
  vi.stubEnv("NEXT_PUBLIC_COGNITO_REGION", "ap-northeast-1");
  vi.stubEnv("NEXT_PUBLIC_COGNITO_CALLBACK_URL", "https://app.tastile.app/auth/callback");
  vi.stubEnv("NEXT_PUBLIC_COGNITO_LOGOUT_URL", "https://app.tastile.app");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("resolveAuthenticatedUserSub", () => {
  it("rejects a forged uid cookie when no Cognito access token exists", async () => {
    cookieStore.set(COOKIE_USER_SUB, "victim-sub");
    const fetchImpl = vi.fn();

    await expect(
      resolveAuthenticatedUserSub({ cookieStore: cookies(), fetchImpl }),
    ).resolves.toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("rejects an unverified or expired access token", async () => {
    cookieStore.set(COOKIE_ACCESS_TOKEN, "forged.jwt.value");
    const fetchImpl = vi.fn(async () => new Response("Unauthorized", { status: 401 }));

    await expect(
      resolveAuthenticatedUserSub({ cookieStore: cookies(), fetchImpl }),
    ).resolves.toBeNull();
  });

  it("rejects a session when the configured issuer does not match the user pool", async () => {
    cookieStore.set(COOKIE_ACCESS_TOKEN, "otherwise-valid-token");
    const fetchImpl = vi.fn(
      async () => new Response(JSON.stringify({ sub: "wrong-pool-sub" }), { status: 200 }),
    );

    await expect(
      resolveAuthenticatedUserSub({
        cookieStore: cookies(),
        fetchImpl,
        env: {
          userPoolId: "ap-northeast-1_pool",
          clientId: "client",
          hostedUiDomain: "tastile",
          issuer: "https://issuer.example/wrong-pool",
          jwksUrl: "https://issuer.example/wrong-pool/.well-known/jwks.json",
          hostedUiBaseUrl: "https://tastile.auth.ap-northeast-1.amazoncognito.com",
          region: "ap-northeast-1",
          callbackUrl: "https://app.tastile.app/auth/callback",
          logoutUrl: "https://app.tastile.app",
        },
      }),
    ).resolves.toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("accepts only the sub returned by Cognito userInfo", async () => {
    cookieStore.set(COOKIE_ACCESS_TOKEN, "verified-access-token");
    cookieStore.set(COOKIE_USER_SUB, "forged-sub");
    const fetchImpl = vi.fn(
      async () => new Response(JSON.stringify({ sub: "verified-sub" }), { status: 200 }),
    );

    await expect(
      resolveAuthenticatedUserSub({ cookieStore: cookies(), fetchImpl }),
    ).resolves.toBe("verified-sub");
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://tastile.auth.ap-northeast-1.amazoncognito.com/oauth2/userInfo",
      expect.objectContaining({
        headers: { authorization: "Bearer verified-access-token" },
      }),
    );
  });
});

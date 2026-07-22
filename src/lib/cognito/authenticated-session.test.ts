import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyTestPoolToEnv, setupTestPoolFromEnv, type TestPoolConfig } from "@/lib/test/setupTestPoolFromEnv";
import { COOKIE_ACCESS_TOKEN, COOKIE_USER_SUB } from "./cookies";
import { resolveAuthenticatedUserSub } from "./authenticated-session";

const POOL: TestPoolConfig = setupTestPoolFromEnv();

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
  applyTestPoolToEnv(POOL);
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
          userPoolId: POOL.userPoolId,
          clientId: POOL.clientId,
          hostedUiDomain: POOL.hostedUiDomain,
          issuer: "https://issuer.example/wrong-pool",
          jwksUrl: "https://issuer.example/wrong-pool/.well-known/jwks.json",
          hostedUiBaseUrl: `https://${POOL.hostedUiDomain}.auth.${POOL.region}.amazoncognito.com`,
          region: POOL.region,
          callbackUrl: POOL.callbackUrl,
          logoutUrl: POOL.logoutUrl,
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
      `https://${POOL.hostedUiDomain}.auth.${POOL.region}.amazoncognito.com/oauth2/userInfo`,
      expect.objectContaining({
        headers: { authorization: "Bearer verified-access-token" },
      }),
    );
  });
});

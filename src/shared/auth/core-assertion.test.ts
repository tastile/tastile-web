import { betterAuth } from "better-auth";
import { jwt } from "better-auth/plugins";
import { memoryAdapter } from "better-auth/adapters/memory";
import { beforeAll, describe, expect, it, vi } from "vitest";

import {
  CORE_ASSERTION_AUDIENCE,
  CORE_ASSERTION_TTL_SECONDS,
  coreAssertionJwtOptions,
} from "./better-auth/core-assertion-config";

// The real BetterAuth jwt plugin runs against an in-memory adapter. The
// Postgres bootstrap and the live server singleton are replaced, so the test
// exercises the same signing configuration that server.ts installs.
const ISSUER = "https://staging-app.tastile.app";
const hoisted = vi.hoisted(() => ({ auth: null as unknown }));

vi.mock("@/shared/auth/better-auth/server", () => ({
  getAuth: async () => hoisted.auth,
  authDatabase: async () => ({}),
}));
vi.mock("@/lib/migrations/better-auth-jwks", () => ({
  ensureBetterAuthJwksSchema: vi.fn(async () => undefined),
}));

import { mintCoreAssertion } from "./core-assertion";

type DecodedJwt = {
  header: Record<string, unknown>;
  payload: Record<string, unknown>;
};

function decodeJwtUnverified(token: string): DecodedJwt {
  const parts = token.split(".");
  expect(parts).toHaveLength(3);
  const json = (segment: string) =>
    JSON.parse(Buffer.from(segment, "base64url").toString("utf8")) as Record<string, unknown>;
  return { header: json(parts[0]!), payload: json(parts[1]!) };
}

describe("mintCoreAssertion", () => {
  beforeAll(async () => {
    hoisted.auth = await betterAuth({
      baseURL: ISSUER,
      basePath: "/api/auth",
      secret: "unit-test-only-secret-value-0123456789abcdef",
      database: memoryAdapter({ jwks: [] }),
      plugins: [jwt(coreAssertionJwtOptions(ISSUER))],
    });
  });

  it("mints an EdDSA token with kid, aud, iss, sub and a bounded lifetime", async () => {
    const before = Math.floor(Date.now() / 1000);
    const token = await mintCoreAssertion("better-auth-user-42");
    const after = Math.floor(Date.now() / 1000);

    const { header, payload } = decodeJwtUnverified(token);

    expect(header.alg).toBe("EdDSA");
    expect(typeof header.kid).toBe("string");
    expect(String(header.kid).length).toBeGreaterThan(0);

    expect(payload.iss).toBe(ISSUER);
    expect(payload.aud).toBe(CORE_ASSERTION_AUDIENCE);
    expect(payload.sub).toBe("better-auth-user-42");

    const iat = payload.iat as number;
    const exp = payload.exp as number;
    expect(iat).toBeGreaterThanOrEqual(before);
    expect(iat).toBeLessThanOrEqual(after);
    expect(exp - iat).toBeGreaterThan(0);
    expect(exp - iat).toBeLessThanOrEqual(300);
    expect(exp - iat).toBe(CORE_ASSERTION_TTL_SECONDS);
  });

  it("publishes the signing key in the JWKS under the same kid", async () => {
    const token = await mintCoreAssertion("better-auth-user-42");
    const { header } = decodeJwtUnverified(token);

    const auth = hoisted.auth as { api: { getJwks: () => Promise<{ keys: Record<string, unknown>[] }> } };
    const jwks = await auth.api.getJwks();
    const key = jwks.keys.find((k) => k.kid === header.kid);

    expect(key).toBeDefined();
    expect(key?.kty).toBe("OKP");
    expect(key?.crv).toBe("Ed25519");
  });
});

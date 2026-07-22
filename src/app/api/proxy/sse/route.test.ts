import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { setupTestPoolFromEnv, type TestPoolConfig } from "@/lib/test/setupTestPoolFromEnv";

const POOL: TestPoolConfig = setupTestPoolFromEnv();
const APP_BASE_URL = (() => {
  try {
    return new URL(POOL.callbackUrl).origin;
  } catch {
    return "https://app.example.test";
  }
})();

const ensureDefaultApiTokenForUser = vi.fn();
const resolveAuthenticatedUserSub = vi.fn();

vi.mock("@/lib/account/api-token-session", () => ({
  ensureDefaultApiTokenForUser,
  getApiTokenFromRequest: (request: NextRequest) => {
    const authorization = request.headers.get("authorization");
    const match = authorization && /^Bearer\s+(\S+)$/i.exec(authorization);
    return match?.[1] ?? request.cookies.get("tastile_api_token")?.value ?? null;
  },
}));

vi.mock("@/lib/cognito/authenticated-session", () => ({
  resolveAuthenticatedUserSub,
}));

beforeEach(() => {
  ensureDefaultApiTokenForUser.mockReset();
  resolveAuthenticatedUserSub.mockReset();
});

describe("GET /api/proxy/sse", () => {
  it("rejects forged identity cookies when no direct API token exists", async () => {
    resolveAuthenticatedUserSub.mockResolvedValueOnce(null);
    const { GET } = await import("./route");
    const request = new NextRequest(`${APP_BASE_URL}/api/proxy/sse`, {
      headers: { cookie: "tastile_uid=victim; tastile_id_token=header.payload.sig" },
    });

    const response = await GET(request);

    expect(response.status).toBe(401);
    expect(ensureDefaultApiTokenForUser).not.toHaveBeenCalled();
  });

  it("keeps direct bearer auth isolated from bridge identity creation", async () => {
    const { GET } = await import("./route");
    const request = new NextRequest(`${APP_BASE_URL}/api/proxy/sse`, {
      headers: { authorization: "Bearer direct-api-token", cookie: "tastile_uid=forged" },
    });

    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/event-stream");
    expect(resolveAuthenticatedUserSub).not.toHaveBeenCalled();
    expect(ensureDefaultApiTokenForUser).not.toHaveBeenCalled();
    await response.body?.cancel();
  });

  it("keeps the API-token cookie path isolated from forged uid cookies", async () => {
    const { GET } = await import("./route");
    const request = new NextRequest(`${APP_BASE_URL}/api/proxy/sse`, {
      headers: { cookie: "tastile_api_token=direct-token; tastile_uid=forged" },
    });

    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(resolveAuthenticatedUserSub).not.toHaveBeenCalled();
    expect(ensureDefaultApiTokenForUser).not.toHaveBeenCalled();
    await response.body?.cancel();
  });
});

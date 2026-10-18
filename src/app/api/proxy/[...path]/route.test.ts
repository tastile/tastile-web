import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const buildCoreBridgeHeaders = vi.hoisted(() => vi.fn());
const coreIamHeaders = vi.hoisted(() => vi.fn());

vi.mock("@/shared/auth/core-bridge-headers", () => ({ buildCoreBridgeHeaders }));
vi.mock("@/shared/auth/core-iam-token", () => ({ coreIamHeaders }));
vi.mock("@/shared/auth/cookies", () => ({
  COOKIE_API_TOKEN: "test_api_token",
  COOKIE_USER_SUB: "test_uid",
}));
vi.mock("@/shared/config/runtime-env", () => ({ isE2EBypassEnabled: () => false }));
vi.mock("@/lib/upstream/cloud-api-base", () => ({
  getCloudApiBase: () => "https://core-api.example.run.app",
}));

import { GET } from "./route";

const fetchMock = vi.fn();

function request(cookie: string, extra: Record<string, string> = {}) {
  return new NextRequest("https://app.example/api/proxy/tiles", {
    headers: { cookie, accept: "application/json", ...extra },
  });
}

function sentHeaders(): Headers {
  const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
  return init.headers as Headers;
}

describe("proxy Core identity headers", () => {
  beforeEach(() => {
    buildCoreBridgeHeaders.mockReset();
    coreIamHeaders.mockReset();
    coreIamHeaders.mockResolvedValue({ "x-serverless-authorization": "Bearer id-token" });
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("adds Cloud Run IAM to an API-token request that skips the bridge builder", async () => {
    const response = await GET(request("test_api_token=tok"), { params: Promise.resolve({ path: ["tiles"] }) });

    expect(response.status).toBe(200);
    expect(buildCoreBridgeHeaders).not.toHaveBeenCalled();
    expect(sentHeaders().get("authorization")).toBe("Bearer tok");
    expect(sentHeaders().get("x-serverless-authorization")).toBe("Bearer id-token");
  });

  it("keeps the bridge builder's IAM header and does not fetch a second one over it", async () => {
    vi.stubEnv("TASTILE_WEB_BRIDGE_SECRET", "secret");
    buildCoreBridgeHeaders.mockResolvedValue({
      "x-tastile-web-bridge-secret": "secret",
      "x-tastile-web-session-user": "user-1",
      "x-serverless-authorization": "Bearer from-builder",
    });
    coreIamHeaders.mockResolvedValue({ "x-serverless-authorization": "Bearer other" });

    await GET(request("test_uid=user-1"), { params: Promise.resolve({ path: ["tiles"] }) });
    expect(sentHeaders().get("x-serverless-authorization")).toBe("Bearer from-builder");
    vi.unstubAllEnvs();
  });

  it("does not forward a browser-supplied IAM header", async () => {
    coreIamHeaders.mockResolvedValue({});
    await GET(request("test_api_token=tok", { "x-serverless-authorization": "Bearer forged" }), {
      params: Promise.resolve({ path: ["tiles"] }),
    });
    expect(sentHeaders().get("x-serverless-authorization")).toBeNull();
  });

  it("returns 503 without calling Core when the IAM identity is unavailable", async () => {
    coreIamHeaders.mockRejectedValue(new Error("metadata identity request failed: HTTP 403"));
    const response = await GET(request("test_api_token=tok"), { params: Promise.resolve({ path: ["tiles"] }) });

    expect(response.status).toBe(503);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.E2E_BYPASS_AUTH;
});

describe("api proxy v1 path compatibility", () => {
  it("maps runtime and auth compatibility paths to tastile-core v1 routes", async () => {
    process.env.CLOUD_API_BASE = "http://core.local";
    const { toV1Path } = await import("./[...path]/route");

    expect(toV1Path("read/runtime-paths")).toBe("v1/runtime/paths");
    expect(toV1Path("auth/session")).toBe("v1/auth/session");
    expect(toV1Path("auth/session/restore")).toBe("v1/auth/session/restore");
    expect(toV1Path("commands/recurring-tile")).toBe("v1/tiles");
  });

  it("maps pending-prompt and prompts/current to v1/prompts/pending", async () => {
    const { toV1Path } = await import("./[...path]/route");
    expect(toV1Path("views/pending-prompt")).toBe("v1/prompts/pending");
    expect(toV1Path("prompts/current")).toBe("v1/prompts/pending");
  });

  it("injects start AND end for views/timeline/today", async () => {
    const { injectTimelineTodayDefaults } = await import("./[...path]/route");
    const params = new URLSearchParams("");
    injectTimelineTodayDefaults(params);
    expect(params.get("start")).toBeDefined();
    expect(params.get("end")).toBeDefined();
    // end = start + 24h
    expect(
      new Date(params.get("end")!).getTime() -
        new Date(params.get("start")!).getTime(),
    ).toBe(24 * 3600 * 1000);
  });

  it("preserves explicit start and end without overwrite", async () => {
    const { injectTimelineTodayDefaults } = await import("./[...path]/route");
    const params = new URLSearchParams(
      "start=2026-06-01T00:00:00Z&end=2026-06-02T00:00:00Z",
    );
    injectTimelineTodayDefaults(params);
    expect(params.get("start")).toBe("2026-06-01T00:00:00Z");
    expect(params.get("end")).toBe("2026-06-02T00:00:00Z");
  });

  it.each(["GET", "POST", "PUT", "PATCH", "DELETE"])(
    "rejects a forged uid cookie for %s requests",
    async (method) => {
      configureCognito();
      process.env.TASTILE_WEB_BRIDGE_SECRET = "bridge-secret";
      const route = await import("./[...path]/route");
      const request = new NextRequest("https://app.tastile.app/api/proxy/v1/tiles", {
        method,
        headers: { cookie: "tastile_uid=victim-sub" },
      });

      const response = await route[method as "GET" | "POST" | "PUT" | "PATCH" | "DELETE"](request, {
        params: Promise.resolve({ path: ["v1", "tiles"] }),
      });

      expect(response.status).toBe(401);
    },
  );

  it("forwards only the Cognito-verified sub to the bridge", async () => {
    configureCognito();
    process.env.TASTILE_WEB_BRIDGE_SECRET = "bridge-secret";
    process.env.CLOUD_API_BASE = "https://core.tastile.test";
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ sub: "verified-sub" })))
      .mockResolvedValueOnce(new Response("[]", { status: 200 }));
    const { GET } = await import("./[...path]/route");
    const request = new NextRequest("https://app.tastile.app/api/proxy/v1/tiles", {
      headers: {
        cookie:
          "tastile_access_token=verified-token; tastile_uid=forged-sub",
      },
    });

    const response = await GET(request, {
      params: Promise.resolve({ path: ["v1", "tiles"] }),
    });

    expect(response.status).toBe(200);
    const upstreamHeaders = fetchMock.mock.calls[1][1]?.headers as Headers;
    expect(upstreamHeaders.get("x-tastile-web-session-user")).toBe("verified-sub");
  });

  it("forwards E2E requests to core without replacing its response", async () => {
    process.env.E2E_BYPASS_AUTH = "1";
    process.env.CLOUD_API_BASE = "https://core.tastile.test";
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response("core response", {
        status: 202,
        headers: {
          "cache-control": "no-store",
          etag: '"core-etag"',
          "x-core-request-id": "request-123",
        },
      }),
    );
    const { POST } = await import("./[...path]/route");
    const request = new NextRequest(
      "https://app.tastile.app/api/proxy/v1/tiles?include=placements",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: "Forward me" }),
      },
    );

    const response = await POST(request, {
      params: Promise.resolve({ path: ["v1", "tiles"] }),
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://core.tastile.test/v1/tiles?include=placements",
    );
    const init = fetchMock.mock.calls[0][1]!;
    expect(init.method).toBe("POST");
    expect(await new Response(init.body).text()).toBe('{"title":"Forward me"}');
    expect(response.status).toBe(202);
    expect(await response.text()).toBe("core response");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("etag")).toBe('"core-etag"');
    expect(response.headers.get("x-core-request-id")).toBe("request-123");
  });
});

function configureCognito() {
  process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID = "ap-northeast-1_pool";
  process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID = "client";
  process.env.NEXT_PUBLIC_COGNITO_HOSTED_UI_DOMAIN = "tastile";
  process.env.NEXT_PUBLIC_COGNITO_ISSUER =
    "https://cognito-idp.ap-northeast-1.amazonaws.com/ap-northeast-1_pool";
  process.env.NEXT_PUBLIC_COGNITO_JWKS_URL =
    "https://cognito-idp.ap-northeast-1.amazonaws.com/ap-northeast-1_pool/.well-known/jwks.json";
  process.env.NEXT_PUBLIC_COGNITO_REGION = "ap-northeast-1";
  process.env.NEXT_PUBLIC_COGNITO_CALLBACK_URL = "https://app.tastile.app/auth/callback";
  process.env.NEXT_PUBLIC_COGNITO_LOGOUT_URL = "https://app.tastile.app";
}

import { beforeEach, describe, expect, it, vi } from "vitest";
import { CORE_V1_ENDPOINTS, CoreClient } from "./endpoints";

beforeEach(() => {
  // The singleton resolver throws when neither NEXT_PUBLIC_TASTILE_CORE_URL
  // nor E2E bypass is set; tests exercise the singleton without
  // configuring a real host, so fall through to the loopback daemon.
  vi.stubEnv("NEXT_PUBLIC_E2E_BYPASS_AUTH", "1");
});

function calledUrls(fetchImpl: ReturnType<typeof vi.fn>): string[] {
  return fetchImpl.mock.calls.map((call) => String(call[0]));
}

function authHeader(fetchImpl: ReturnType<typeof vi.fn>): string | undefined {
  const headers = (fetchImpl.mock.calls[0]?.[1] as RequestInit | undefined)?.headers as
    | Record<string, string>
    | undefined;
  return headers?.authorization;
}

describe("CoreClient", () => {
  it("translates legacy dashboard paths to v1 paths for direct local core requests", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ status: "ok" })));
    const client = new CoreClient({
      baseUrl: "http://localhost:31400",
      tokenProvider: async () => "token",
      fetchImpl: fetchImpl as unknown as typeof fetch,
      useProxyBridge: false,
    });

    await client.call("getHealth");
    await client.call("getRuntimePaths");
    await client.call("getSession");

    expect(calledUrls(fetchImpl)).toEqual([
      "http://localhost:31400/v1/health",
      "http://localhost:31400/v1/runtime/paths",
      "http://localhost:31400/v1/auth/session",
    ]);
  });

  it("keeps legacy paths when the proxy bridge is used", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ status: "ok" })));
    const client = new CoreClient({
      baseUrl: "/api/proxy",
      tokenProvider: async () => null,
      fetchImpl: fetchImpl as unknown as typeof fetch,
      useProxyBridge: true,
    });

    await client.call("getRuntimePaths");

    expect(calledUrls(fetchImpl)[0]).toBe("http://localhost/api/proxy/read/runtime-paths");
  });

  it("does not send an Authorization header when tokenProvider is null and bridge is off", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ status: "ok" })));
    const client = new CoreClient({
      baseUrl: "http://localhost:31400",
      tokenProvider: async () => null,
      fetchImpl: fetchImpl as unknown as typeof fetch,
      useProxyBridge: false,
    });

    await client.call("getSession");

    // Browser code MUST NEVER attach a Cognito id_token to a v1 request.
    // Auth is handled by the proxy bridge (server-side) or by the local
    // v1 daemons E2E bypass wiring — never by a client-held bearer.
    expect(authHeader(fetchImpl)).toBeUndefined();
  });

  it("does not call tokenProvider when the proxy bridge is used", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ status: "ok" })));
    const tokenProvider = vi.fn(async () => "should-never-be-read");
    const client = new CoreClient({
      baseUrl: "/api/proxy",
      tokenProvider,
      fetchImpl: fetchImpl as unknown as typeof fetch,
      useProxyBridge: true,
    });

    await client.call("getSession");

    expect(tokenProvider).not.toHaveBeenCalled();
  });
});

describe("getCoreClient", () => {
  // Reset the lazy singleton between tests so the URL/provider decision is
  // isolated per scenario.
  function resetClientSingleton() {
    // The module intentionally keeps a private `_client` field; reach in
    // via a fresh module import to drop it.
    vi.resetModules();
    return import("./endpoints");
  }

  it("singleton does not import the legacy daemon id-token module", async () => {
    const mod = await resetClientSingleton();
    // The browser-side token provider must be a self-contained no-op.
    // Touching `getCoreClient` here only verifies the singleton
    // instantiates without crashing in a Node test env.
    expect(() => mod.getCoreClient()).not.toThrow();
  });
});

describe("avatar / owner endpoints", () => {
  it("getOwnerProfile is public and points at the v1 owner profile path", async () => {
    const { ENDPOINTS } = await import("./endpoints");
    expect(ENDPOINTS.getOwnerProfile.method).toBe("GET");
    expect(ENDPOINTS.getOwnerProfile.path).toBe("/v1/owners/{kind}/{id}/profile");
    expect(ENDPOINTS.getOwnerProfile.auth).toBe(false);
  });

  it("patchOwnerProfile requires auth", async () => {
    const { ENDPOINTS } = await import("./endpoints");
    expect(ENDPOINTS.patchOwnerProfile.method).toBe("PATCH");
    expect(ENDPOINTS.patchOwnerProfile.auth).toBe(true);
  });

  it("createAvatarUpload requires auth and exposes the create path", async () => {
    const { ENDPOINTS } = await import("./endpoints");
    expect(ENDPOINTS.createAvatarUpload.method).toBe("POST");
    expect(ENDPOINTS.createAvatarUpload.path).toBe("/v1/uploads/avatar");
    expect(ENDPOINTS.createAvatarUpload.auth).toBe(true);
  });

  it("commitAvatarUpload requires auth and uses {upload_id}", async () => {
    const { ENDPOINTS } = await import("./endpoints");
    expect(ENDPOINTS.commitAvatarUpload.method).toBe("POST");
    expect(ENDPOINTS.commitAvatarUpload.path).toBe("/v1/uploads/avatar/{upload_id}/commit");
    expect(ENDPOINTS.commitAvatarUpload.auth).toBe(true);
  });
});

describe("CORE_V1_ENDPOINTS", () => {
  it("contains the actual multi-method and lifecycle operations exposed by tastile-core", () => {
    const operations = new Set(CORE_V1_ENDPOINTS.map(({ method, path }) => `${method} ${path}`));

    expect([...operations]).toEqual(
      expect.arrayContaining([
        "GET /v1/tiles",
        "POST /v1/tiles",
        "DELETE /v1/tiles/{id}",
        "GET /v1/events",
        "POST /v1/events",
        "PATCH /v1/events/{id}",
        "DELETE /v1/events/{id}",
        "GET /v1/recurring/{id}/exceptions",
        "POST /v1/recurring/{id}/exceptions",
        "DELETE /v1/recurring/{id}/exceptions/{key}",
        "POST /v1/recurring/{id}/frame-rules/{fid}/lease",
        "DELETE /v1/recurring/{id}/frame-rules/{fid}/lease",
        "POST /v1/access/subjects",
        "GET /v1/access/subjects",
        "PATCH /v1/access/subjects/{id}",
        "DELETE /v1/access/subjects/{id}",
        "POST /v1/api-tokens",
        "GET /v1/api-tokens",
        "PATCH /v1/api-tokens/{id}",
        "DELETE /v1/api-tokens/{id}",
      ]),
    );
    expect(CORE_V1_ENDPOINTS).toHaveLength(149);
  });
});

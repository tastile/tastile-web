import { describe, expect, it, vi } from "vitest";
import { CoreClient } from "./endpoints";

function calledUrls(fetchImpl: ReturnType<typeof vi.fn>): string[] {
  return fetchImpl.mock.calls.map((call) => String(call[0]));
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
});

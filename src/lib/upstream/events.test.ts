import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockUserSub = vi.fn();
vi.mock("@/shared/auth/authenticated-session", () => ({
  resolveAuthenticatedUserSub: (...args: unknown[]) => mockUserSub(...args),
}));

import { upstreamGetOwnerProfile } from "./events";

const fetchMock = vi.fn();

beforeEach(() => {
  mockUserSub.mockReset();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("CLOUD_API_BASE", "https://core.internal.example");
  vi.stubEnv("TASTILE_WEB_BRIDGE_SECRET", "bridge-secret");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("upstreamGetOwnerProfile", () => {
  it("calls Core at an absolute URL with the bridge headers", async () => {
    mockUserSub.mockResolvedValue("user-sub-1");
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ display_name: "Alice", revision: 2 }), { status: 200 }),
    );

    const res = await upstreamGetOwnerProfile(0, "00000000-0000-4000-8000-000000000001");

    expect(res).toEqual({ status: 200, body: { display_name: "Alice", revision: 2 } });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      "https://core.internal.example/v1/owners/0/00000000-0000-4000-8000-000000000001/profile",
    );
    const headers = init.headers as Record<string, string>;
    expect(headers["x-tastile-web-bridge-secret"]).toBe("bridge-secret");
    expect(headers["x-tastile-web-session-user"]).toBe("user-sub-1");
  });

  it("passes the upstream status through", async () => {
    mockUserSub.mockResolvedValue("user-sub-1");
    fetchMock.mockResolvedValue(new Response("", { status: 404 }));

    const res = await upstreamGetOwnerProfile(0, "00000000-0000-4000-8000-000000000001");

    expect(res).toEqual({ status: 404, body: null });
  });

  it("returns null without calling Core when there is no session", async () => {
    mockUserSub.mockResolvedValue(null);

    const res = await upstreamGetOwnerProfile(0, "00000000-0000-4000-8000-000000000001");

    expect(res).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

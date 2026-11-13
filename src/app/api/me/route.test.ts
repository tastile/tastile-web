import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockSession = vi.fn();
vi.mock("@/shared/auth/authenticated-session", () => ({
  resolveAuthenticatedSession: (...args: unknown[]) => mockSession(...args),
}));

const mockOwnerId = vi.fn();
vi.mock("@/shared/auth/account-session", () => ({
  getAccountOwnerId: (...args: unknown[]) => mockOwnerId(...args),
}));

import { GET } from "./route";

const OWNER_ID = "00000000-0000-4000-8000-000000000001";

function makeRequest(cookie = "tastile_api_token=tok123"): NextRequest {
  return new NextRequest("http://localhost:3011/api/me", {
    headers: { cookie },
  });
}

function mockUpstream(status: number, body: unknown = null) {
  return vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(body === null ? null : JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    }),
  );
}

beforeEach(() => {
  mockSession.mockReset();
  mockOwnerId.mockReset();
  vi.restoreAllMocks();
});

describe("GET /api/me", () => {
  it("returns 401 when no BetterAuth session is present", async () => {
    mockSession.mockResolvedValue(null);
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it("returns the owner profile + session identity when authenticated", async () => {
    mockSession.mockResolvedValue({
      id: "better-auth-user-abc",
      email: "alice@example.com",
      name: "Alice",
      emailVerified: true,
      expiresAtEpochSeconds: 1_900_000_000,
    });
    mockOwnerId.mockResolvedValue(OWNER_ID);
    const fetchMock = mockUpstream(200, {
      display_name: "Alice",
      avatar_url: "https://cdn.tastile.app/committed/0/abc/r1/source.webp",
      bio: "hello",
      accent_color: "#ff0066",
      revision: 1,
    });

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.owner_id).toBe(OWNER_ID);
    expect(body.email).toBe("alice@example.com");
    expect(body.email_verified).toBe(true);
    expect(body.display_name).toBe("Alice");
    expect(body.avatar_url).toContain("cdn.tastile.app");
    expect(body.bio).toBe("hello");
    expect(body.accent_color).toBe("#ff0066");
    expect(body.revision).toBe(1);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      `http://localhost:3011/api/proxy/v1/owners/0/${OWNER_ID}/profile`,
    );
    expect((init.headers as Record<string, string>).cookie).toContain(
      "tastile_api_token=tok123",
    );
  });

  it("returns 401 when upstream returns 401", async () => {
    mockSession.mockResolvedValue({
      id: "u1",
      email: "alice@example.com",
      name: null,
      emailVerified: false,
      expiresAtEpochSeconds: null,
    });
    mockOwnerId.mockResolvedValue(OWNER_ID);
    mockUpstream(401);

    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it("returns 401 when upstream returns 403", async () => {
    mockSession.mockResolvedValue({
      id: "u1",
      email: "alice@example.com",
      name: null,
      emailVerified: false,
      expiresAtEpochSeconds: null,
    });
    mockOwnerId.mockResolvedValue(OWNER_ID);
    mockUpstream(403);

    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it("returns 404 profile with 200 when owner profile not found", async () => {
    mockSession.mockResolvedValue({
      id: "u1",
      email: "alice@example.com",
      name: null,
      emailVerified: false,
      expiresAtEpochSeconds: null,
    });
    mockOwnerId.mockResolvedValue(OWNER_ID);
    mockUpstream(404);

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.owner_id).toBe(OWNER_ID);
    expect(body.email).toBe("alice@example.com");
    expect(body.email_verified).toBe(false);
    expect(body.display_name).toBeNull();
    expect(body.avatar_url).toBeNull();
    expect(body.bio).toBeNull();
    expect(body.accent_color).toBeNull();
    expect(body.revision).toBe(0);
  });

  it("returns 502 for upstream 5xx errors", async () => {
    mockSession.mockResolvedValue({
      id: "u1",
      email: "alice@example.com",
      name: null,
      emailVerified: false,
      expiresAtEpochSeconds: null,
    });
    mockOwnerId.mockResolvedValue(OWNER_ID);
    mockUpstream(502);

    const res = await GET(makeRequest());
    expect(res.status).toBe(502);
  });

  it("returns 502 when the upstream fetch throws", async () => {
    mockSession.mockResolvedValue({
      id: "u1",
      email: "alice@example.com",
      name: null,
      emailVerified: false,
      expiresAtEpochSeconds: null,
    });
    mockOwnerId.mockResolvedValue(OWNER_ID);
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network down"));

    const res = await GET(makeRequest());
    expect(res.status).toBe(502);
  });

  it("E2E bypass synthesizes the fresh-owner shape without upstream calls", async () => {
    process.env.E2E_BYPASS_AUTH = "1";
    try {
      mockOwnerId.mockResolvedValue("00000000-0000-0000-0000-000000000001");
      const fetchMock = vi.spyOn(globalThis, "fetch");
      const res = await GET(makeRequest());
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.owner_id).toBe("00000000-0000-0000-0000-000000000001");
      expect(body.email).toBeNull();
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      delete process.env.E2E_BYPASS_AUTH;
    }
  });
});

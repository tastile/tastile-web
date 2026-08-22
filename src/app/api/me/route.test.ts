import { beforeEach, describe, expect, it, vi } from "vitest";

const mockSession = vi.fn();
vi.mock("@/shared/auth/authenticated-session", () => ({
  resolveAuthenticatedSession: (...args: unknown[]) => mockSession(...args),
}));

const mockOwnerId = vi.fn();
vi.mock("@/shared/auth/account-session", () => ({
  getAccountOwnerId: (...args: unknown[]) => mockOwnerId(...args),
}));

const mockCall = vi.fn();
vi.mock("@/shared/api/endpoints", () => ({
  getCoreClient: () => ({ call: mockCall }),
}));

import { GET } from "./route";

beforeEach(() => {
  mockSession.mockReset();
  mockOwnerId.mockReset();
  mockCall.mockReset();
});

describe("GET /api/me", () => {
  it("returns 401 when no BetterAuth session is present", async () => {
    mockSession.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
    expect(mockCall).not.toHaveBeenCalled();
  });

  it("returns the owner profile + session identity when authenticated", async () => {
    mockSession.mockResolvedValue({
      id: "better-auth-user-abc",
      email: "alice@example.com",
      name: "Alice",
      emailVerified: true,
      expiresAtEpochSeconds: 1_900_000_000,
    });
    mockOwnerId.mockResolvedValue("00000000-0000-4000-8000-000000000001");
    mockCall.mockResolvedValue({
      ok: true,
      data: {
        display_name: "Alice",
        avatar_url: "https://cdn.tastile.app/committed/0/abc/r1/source.webp",
        bio: "hello",
        accent_color: "#ff0066",
        revision: 1,
      },
      status: 200,
      latencyMs: 1,
    });

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.owner_id).toMatch(/^[0-9a-f-]{36}$/);
    expect(body.email).toBe("alice@example.com");
    expect(body.email_verified).toBe(true);
    expect(body.display_name).toBe("Alice");
    expect(body.avatar_url).toContain("cdn.tastile.app");
    expect(body.bio).toBe("hello");
    expect(body.accent_color).toBe("#ff0066");
    expect(body.revision).toBe(1);

    expect(mockCall).toHaveBeenCalledTimes(1);
    expect(mockCall).toHaveBeenCalledWith("getOwnerProfile", {
      pathParams: expect.objectContaining({ kind: "0" }),
    });
  });

  it("returns 401 when upstream returns 401", async () => {
    mockSession.mockResolvedValue({
      id: "u1",
      email: "alice@example.com",
      name: null,
      emailVerified: false,
      expiresAtEpochSeconds: null,
    });
    mockOwnerId.mockResolvedValue("00000000-0000-4000-8000-000000000001");
    mockCall.mockResolvedValue({
      ok: false,
      error: { kind: "auth", status: 401, message: "invalid token", body: null },
    });

    const res = await GET();
    expect(res.status).toBe(401);
    expect(mockCall).toHaveBeenCalledTimes(1);
  });

  it("returns 401 when upstream returns 403", async () => {
    mockSession.mockResolvedValue({
      id: "u1",
      email: "alice@example.com",
      name: null,
      emailVerified: false,
      expiresAtEpochSeconds: null,
    });
    mockOwnerId.mockResolvedValue("00000000-0000-4000-8000-000000000001");
    mockCall.mockResolvedValue({
      ok: false,
      error: { kind: "auth", status: 403, message: "forbidden", body: null },
    });

    const res = await GET();
    expect(res.status).toBe(401);
    expect(mockCall).toHaveBeenCalledTimes(1);
  });

  it("returns 404 profile with 200 when owner profile not found", async () => {
    mockSession.mockResolvedValue({
      id: "u1",
      email: "alice@example.com",
      name: null,
      emailVerified: false,
      expiresAtEpochSeconds: null,
    });
    mockOwnerId.mockResolvedValue("00000000-0000-4000-8000-000000000001");
    mockCall.mockResolvedValue({
      ok: false,
      error: { kind: "not-found", status: 404, message: "profile not found", body: null },
    });

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.owner_id).toMatch(/^[0-9a-f-]{36}$/);
    expect(body.email).toBe("alice@example.com");
    expect(body.email_verified).toBe(false);
    expect(body.display_name).toBeNull();
    expect(body.avatar_url).toBeNull();
    expect(body.bio).toBeNull();
    expect(body.accent_color).toBeNull();
    expect(body.revision).toBe(0);
    expect(mockCall).toHaveBeenCalledTimes(1);
  });

  it("returns 502 for upstream 5xx errors", async () => {
    mockSession.mockResolvedValue({
      id: "u1",
      email: "alice@example.com",
      name: null,
      emailVerified: false,
      expiresAtEpochSeconds: null,
    });
    mockOwnerId.mockResolvedValue("00000000-0000-4000-8000-000000000001");
    mockCall.mockResolvedValue({
      ok: false,
      error: { kind: "server", status: 502, message: "upstream failure", body: null },
    });

    const res = await GET();
    expect(res.status).toBe(502);
  });

  it("E2E bypass synthesizes the fresh-owner shape without upstream calls", async () => {
    process.env.E2E_BYPASS_AUTH = "1";
    try {
      mockOwnerId.mockResolvedValue("00000000-0000-0000-0000-000000000001");
      const res = await GET();
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.owner_id).toBe("00000000-0000-0000-0000-000000000001");
      expect(body.email).toBeNull();
      expect(mockCall).not.toHaveBeenCalled();
    } finally {
      delete process.env.E2E_BYPASS_AUTH;
    }
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

const resolveAuthenticatedUserSub = vi.fn();
const mintBrowserApiToken = vi.fn();
const cookieStore = new Map<string, string>();

vi.mock("@/shared/auth/authenticated-session", () => ({
  resolveAuthenticatedUserSub,
}));

vi.mock("@/lib/account/api-token-session", () => ({
  mintBrowserApiToken,
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => {
      const value = cookieStore.get(name);
      return value === undefined ? undefined : { value };
    },
  }),
}));

beforeEach(() => {
  resolveAuthenticatedUserSub.mockReset();
  mintBrowserApiToken.mockReset();
  cookieStore.clear();
});

describe("GET /api/auth/core-token", () => {
  it("rejects an unauthenticated caller without minting anything", async () => {
    resolveAuthenticatedUserSub.mockResolvedValueOnce(null);
    const { GET } = await import("./route");

    const response = await GET();

    expect(response.status).toBe(401);
    expect(mintBrowserApiToken).not.toHaveBeenCalled();
  });

  it("mints a short-lived token and caches it in an httpOnly cookie", async () => {
    const expiresAt = new Date(Date.now() + 3_600_000).toISOString();
    resolveAuthenticatedUserSub.mockResolvedValueOnce("user-sub");
    mintBrowserApiToken.mockResolvedValueOnce({ token: "minted", expiresAt });
    const { GET } = await import("./route");

    const response = await GET();
    const body = (await response.json()) as { token: string; expiresAt: string };

    expect(body).toEqual({ token: "minted", expiresAt });
    const cookie = response.cookies.get("tastile_core_browser_token");
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.value).toContain("minted");
  });

  it("never returns Cognito credentials", async () => {
    resolveAuthenticatedUserSub.mockResolvedValueOnce("user-sub");
    mintBrowserApiToken.mockResolvedValueOnce({
      token: "minted",
      expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
    });
    const { GET } = await import("./route");

    const body = (await (await GET()).json()) as Record<string, unknown>;

    expect(Object.keys(body).sort()).toEqual(["expiresAt", "token"]);
  });

  it("reuses a cached cookie token instead of minting a new row", async () => {
    resolveAuthenticatedUserSub.mockResolvedValueOnce("user-sub");
    const expiresAtMs = Date.now() + 3_600_000;
    cookieStore.set("tastile_core_browser_token", `${expiresAtMs}.cached`);
    const { GET } = await import("./route");

    const body = (await (await GET()).json()) as { token: string };

    expect(body.token).toBe("cached");
    expect(mintBrowserApiToken).not.toHaveBeenCalled();
  });

  it("re-mints when the cached token is inside the refresh margin", async () => {
    resolveAuthenticatedUserSub.mockResolvedValueOnce("user-sub");
    cookieStore.set("tastile_core_browser_token", `${Date.now() + 60_000}.nearly-expired`);
    mintBrowserApiToken.mockResolvedValueOnce({
      token: "fresh",
      expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
    });
    const { GET } = await import("./route");

    const body = (await (await GET()).json()) as { token: string };

    expect(body.token).toBe("fresh");
  });

  it("returns 502 when the mint fails", async () => {
    resolveAuthenticatedUserSub.mockResolvedValueOnce("user-sub");
    mintBrowserApiToken.mockResolvedValueOnce(null);
    const { GET } = await import("./route");

    expect((await GET()).status).toBe(502);
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

const cookieStore: Record<string, { value: string; options: Record<string, unknown> }> = {};

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: (n: string) => cookieStore[n],
  })),
}));

const mockCall = vi.fn();
vi.mock("@/lib/api/endpoints", () => ({
  getCoreClient: () => ({ call: mockCall }),
}));

import { COOKIE_ID_TOKEN } from "@/lib/cognito/cookies";
import { GET } from "./route";

function makeIdToken(claims: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  return `${header}.${payload}.sig`;
}

beforeEach(() => {
  for (const k of Object.keys(cookieStore)) delete cookieStore[k];
  mockCall.mockReset();
});

describe("GET /api/me", () => {
  it("returns 401 when no id_token cookie is present", async () => {
    const res = await GET();
    expect(res.status).toBe(401);
    expect(mockCall).not.toHaveBeenCalled();
  });

  it("returns the owner profile + claims when authenticated", async () => {
    const sub = "user-sub-abc";
    cookieStore[COOKIE_ID_TOKEN] = {
      value: makeIdToken({
        sub,
        email: "alice@example.com",
        email_verified: true,
        exp: 0,
      }),
      options: {},
    };
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

  it("returns 502 when the upstream profile call fails", async () => {
    cookieStore[COOKIE_ID_TOKEN] = {
      value: makeIdToken({ sub: "x", exp: 0 }),
      options: {},
    };
    mockCall.mockResolvedValue({
      ok: false,
      error: { kind: "server", status: 500, message: "boom", body: null },
    });

    const res = await GET();
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.error).toBe("UPSTREAM_FAILURE");
  });
});
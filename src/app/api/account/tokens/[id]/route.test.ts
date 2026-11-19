import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockUserSub = vi.fn();
vi.mock("@/shared/auth/account-session", () => ({
  getAccountUserSub: (...args: unknown[]) => mockUserSub(...args),
}));

import { DELETE, PATCH } from "./route";

const TOKEN_ID = "00000000-0000-4000-8000-0000000000aa";

function makeRequest(method: string, body?: string): NextRequest {
  return new NextRequest(`http://localhost:3011/api/account/tokens/${TOKEN_ID}`, {
    method,
    headers: { "content-type": "application/json" },
    body,
  });
}

function context() {
  return { params: Promise.resolve({ id: TOKEN_ID }) };
}

function mockUpstream(status: number, body: string | null = null) {
  return vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(body, { status, headers: { "content-type": "application/json" } }),
  );
}

beforeEach(() => {
  mockUserSub.mockReset();
  mockUserSub.mockResolvedValue("user-sub-1");
  process.env.TASTILE_WEB_BRIDGE_SECRET = "test-bridge-secret";
  process.env.CLOUD_API_BASE = "https://core.tastile.test";
  vi.restoreAllMocks();
});

describe("DELETE /api/account/tokens/[id]", () => {
  it("returns 204 without a body when upstream revokes with 204", async () => {
    mockUpstream(204);
    const res = await DELETE(makeRequest("DELETE"), context());
    expect(res.status).toBe(204);
    expect(await res.text()).toBe("");
  });

  it("forwards upstream error status and body", async () => {
    mockUpstream(404, JSON.stringify({ error: "token_not_found" }));
    const res = await DELETE(makeRequest("DELETE"), context());
    expect(res.status).toBe(404);
    expect(await res.text()).toContain("token_not_found");
  });

  it("returns 401 when unauthenticated", async () => {
    mockUserSub.mockResolvedValue(null);
    const res = await DELETE(makeRequest("DELETE"), context());
    expect(res.status).toBe(401);
  });
});

describe("PATCH /api/account/tokens/[id]", () => {
  it("forwards the renamed token payload and upstream body", async () => {
    const fetchMock = mockUpstream(200, JSON.stringify({ id: TOKEN_ID, label: "cli" }));
    const res = await PATCH(makeRequest("PATCH", JSON.stringify({ name: "cli" })), context());
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('"name":"cli"');
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({ label: "cli" });
  });
});

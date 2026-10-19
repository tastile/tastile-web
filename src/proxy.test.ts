import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/host-routing", () => ({ resolveCanonicalHostRedirect: () => null }));
vi.mock("@/shared/config/runtime-env", () => ({ isE2EBypassEnabled: () => false }));

import proxy from "./proxy";

function request(path: string, headers: Record<string, string> = {}) {
  return new NextRequest(`https://staging-app.example${path}`, { headers });
}

describe("proxy edge assertion gate", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("rejects a direct origin request without the edge assertion", async () => {
    vi.stubEnv("TASTILE_EDGE_ASSERTION", "edge-secret");
    const response = await proxy(request("/login"));
    expect(response.status).toBe(403);
  });

  it("rejects a wrong edge assertion before the session gate", async () => {
    vi.stubEnv("TASTILE_EDGE_ASSERTION", "edge-secret");
    const response = await proxy(request("/dashboard", { "x-tastile-edge-assertion": "other" }));
    expect(response.status).toBe(403);
  });

  it("lets an edge-forwarded request reach the normal routing", async () => {
    vi.stubEnv("TASTILE_EDGE_ASSERTION", "edge-secret");
    const response = await proxy(request("/login", { "x-tastile-edge-assertion": "edge-secret" }));
    expect(response.status).toBe(200);
  });

  it("keeps only the public JWKS reachable without the edge assertion", async () => {
    vi.stubEnv("TASTILE_EDGE_ASSERTION", "edge-secret");
    expect((await proxy(request("/api/auth/jwks"))).status).not.toBe(403);
    expect((await proxy(request("/api/auth/jwks/extra"))).status).toBe(403);
    expect((await proxy(request("/api/auth/get-session"))).status).toBe(403);
    expect((await proxy(request("/api/auth/token"))).status).toBe(403);
  });

  it("does not gate requests when no edge assertion is configured", async () => {
    vi.stubEnv("TASTILE_EDGE_ASSERTION", "");
    const response = await proxy(request("/login"));
    expect(response.status).toBe(200);
  });
});

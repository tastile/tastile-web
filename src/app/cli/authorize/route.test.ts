import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const insertPendingConsentMock = vi.fn();

vi.mock("@/shared/auth/cli/pending-consent-store", () => ({
  insertPendingConsent: (...args: unknown[]) => insertPendingConsentMock(...args),
}));

const resolveUserSubMock = vi.fn();

vi.mock("@/shared/auth/authenticated-session", () => ({
  resolveAuthenticatedUserSub: (...args: unknown[]) => resolveUserSubMock(...args),
}));

const ORIGINAL_ENV = process.env;

const QUERY = new URLSearchParams({
  response_type: "code",
  client_id: "tastile-cli",
  redirect_uri: "http://127.0.0.1:1234/callback",
  scope: "tastile.read tastile.write",
  state: "csrf-state",
  code_challenge: "challenge-1",
  code_challenge_method: "S256",
}).toString();

function getAuthorize(search = QUERY): NextRequest {
  return new NextRequest(`https://app.test/cli/authorize?${search}`, {
    method: "GET",
  });
}

describe("GET /cli/authorize", () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    delete process.env.E2E_BYPASS_AUTH;
    insertPendingConsentMock.mockReset();
    resolveUserSubMock.mockReset();
    insertPendingConsentMock.mockResolvedValue("tid-from-store");
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  it("valid 7-param query + session → 302 /cli/consent?tid=...", async () => {
    resolveUserSubMock.mockResolvedValueOnce("user-1");
    const { GET } = await import("./route");
    const response = await GET(getAuthorize());
    expect(response.status).toBe(307);
    const location = response.headers.get("location") ?? "";
    expect(location).toContain("/cli/consent");
    expect(location).toContain("tid=tid-from-store");
    expect(insertPendingConsentMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userSub: "user-1",
        clientId: "tastile-cli",
        codeChallenge: "challenge-1",
        scopesEffective: "tastile.read tastile.write",
      }),
    );
  });

  it("unknown client_id → 400 without leaking registered set", async () => {
    const params = new URLSearchParams(QUERY);
    params.set("client_id", "rogue-client");
    const { GET } = await import("./route");
    const response = await GET(getAuthorize(params.toString()));
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("invalid_client");
    // The error MUST NOT name any other registered client.
    expect(JSON.stringify(body)).not.toContain("tastile-cli");
  });

  it("non-loopback redirect → 400 invalid_redirect_uri", async () => {
    const params = new URLSearchParams(QUERY);
    params.set("redirect_uri", "https://attacker.example/callback");
    const { GET } = await import("./route");
    const response = await GET(getAuthorize(params.toString()));
    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe("invalid_redirect_uri");
  });

  it("PKCE method != S256 → 400 invalid_request", async () => {
    const params = new URLSearchParams(QUERY);
    params.set("code_challenge_method", "plain");
    const { GET } = await import("./route");
    const response = await GET(getAuthorize(params.toString()));
    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe("invalid_request");
  });

  it("empty scope intersection → 400 invalid_scope", async () => {
    const params = new URLSearchParams(QUERY);
    params.set("scope", "admin foo.read");
    const { GET } = await import("./route");
    const response = await GET(getAuthorize(params.toString()));
    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe("invalid_scope");
  });

  it("no session → 302 /login?next=/cli/authorize?<encoded>", async () => {
    resolveUserSubMock.mockResolvedValueOnce(null);
    const { GET } = await import("./route");
    const response = await GET(getAuthorize());
    expect(response.status).toBe(307);
    const location = response.headers.get("location") ?? "";
    expect(location).toContain("/login");
    expect(location).toContain("next=");
    expect(location).toContain(encodeURIComponent("/cli/authorize"));
  });

  it("response_type != code → 400", async () => {
    const params = new URLSearchParams(QUERY);
    params.set("response_type", "token");
    const { GET } = await import("./route");
    const response = await GET(getAuthorize(params.toString()));
    expect(response.status).toBe(400);
  });

  it("extras in the query → 400", async () => {
    const params = new URLSearchParams(QUERY);
    params.set("extra_param", "value");
    const { GET } = await import("./route");
    const response = await GET(getAuthorize(params.toString()));
    expect(response.status).toBe(400);
  });

  it("E2E_BYPASS_AUTH=1 → 400 bypass_not_permitted (production safety)", async () => {
    process.env.E2E_BYPASS_AUTH = "1";
    resolveUserSubMock.mockResolvedValueOnce("user-1");
    const { GET } = await import("./route");
    const response = await GET(getAuthorize());
    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe("bypass_not_permitted");
    expect(insertPendingConsentMock).not.toHaveBeenCalled();
  });
});

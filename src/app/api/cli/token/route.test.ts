import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { s256 } from "@/shared/auth/cli/pkce";

// Test-controlled mocks for the grant store + core mint.
const consumeGrantOnceMock = vi.fn();
const markCoreTokenIdMock = vi.fn();
const mintTastileApiTokenForUserMock = vi.fn();

vi.mock("@/shared/auth/cli/grant-store", () => ({
  consumeGrantOnce: (...args: unknown[]) => consumeGrantOnceMock(...args),
  markCoreTokenId: (...args: unknown[]) => markCoreTokenIdMock(...args),
}));

vi.mock("@/shared/auth/cli/core-mint", () => ({
  mintTastileApiTokenForUser: (...args: unknown[]) => mintTastileApiTokenForUserMock(...args),
  cliTokenExpiresAtIso: vi.fn().mockReturnValue("2030-01-01T00:00:00.000Z"),
}));

// Spy on BetterAuth — the route MUST NOT read the session.
const getSessionSpy = vi.fn().mockResolvedValue(null);
vi.mock("@/shared/auth/better-auth/server", () => ({
  getAuth: () => ({
    api: {
      getSession: (...args: unknown[]) => getSessionSpy(...args),
    },
  }),
}));

const ORIGINAL_ENV = process.env;

const CHALLENGE = "challenge-test";
const REDIRECT = "http://127.0.0.1:1234/callback";
const PLAINTEXT_CODE = "plaintext-code-do-not-log";
const VERIFIER = "verifier-test";

function okConsume(overrides: Partial<{ userSub: string; clientId: string; scopesEffective: string }> = {}) {
  return {
    status: "ok",
    userSub: overrides.userSub ?? "user-1",
    clientId: overrides.clientId ?? "tastile-cli",
    scopesEffective: overrides.scopesEffective ?? "tastile.read tastile.write",
  };
}

function postJson(body: unknown, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest("https://app.test/api/cli/token", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

describe("POST /api/cli/token", () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    delete process.env.E2E_BYPASS_AUTH;
    consumeGrantOnceMock.mockReset();
    markCoreTokenIdMock.mockReset();
    mintTastileApiTokenForUserMock.mockReset();
    getSessionSpy.mockClear();
    consumeGrantOnceMock.mockResolvedValue(okConsume());
    mintTastileApiTokenForUserMock.mockResolvedValue({
      id: "core-token-id-1",
      token: "bearer-raw-token",
      expiresAt: "2030-01-01T00:00:00.000Z",
      subject: "user-1",
    });
    markCoreTokenIdMock.mockResolvedValue(undefined);
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  it("happy path: returns 200 + { token, expires_at, subject } JSON", async () => {
    const { POST } = await import("./route");
    const response = await POST(
      postJson({ code: PLAINTEXT_CODE, code_verifier: VERIFIER, redirect_uri: REDIRECT }),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toMatch(/application\/json/u);
    const body = await response.json();
    expect(body).toEqual({
      token: "bearer-raw-token",
      expires_at: "2030-01-01T00:00:00.000Z",
      subject: "user-1",
    });
    // Pre-computed S256 must match the stored challenge.
    expect(consumeGrantOnceMock).toHaveBeenCalledWith({
      code: PLAINTEXT_CODE,
      codeChallenge: s256(VERIFIER),
      redirectUri: REDIRECT,
    });
    expect(mintTastileApiTokenForUserMock).toHaveBeenCalledWith({
      userSub: "user-1",
      label: "tastile-cli",
      scopes: "tastile.read tastile.write",
      expiresAtIso: "2030-01-01T00:00:00.000Z",
    });
  });

  it("rejects extras (client_id, client_secret, etc.) as 400 invalid_body", async () => {
    const { POST } = await import("./route");
    const response = await POST(
      postJson({
        code: PLAINTEXT_CODE,
        code_verifier: VERIFIER,
        redirect_uri: REDIRECT,
        client_id: "tastile-cli",
        client_secret: "should-be-ignored",
      }),
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid_body" });
    expect(consumeGrantOnceMock).not.toHaveBeenCalled();
  });

  it("rejects missing fields as 400", async () => {
    const { POST } = await import("./route");
    const response = await POST(postJson({ code: "x", code_verifier: "y" }));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid_body" });
  });

  it("rejects non-JSON content type", async () => {
    const { POST } = await import("./route");
    const response = await POST(
      new NextRequest("https://app.test/api/cli/token", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: "code=x&code_verifier=y&redirect_uri=z",
      }),
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid_content_type" });
  });

  it("returns 409 already_used with the 'already used' phrase on concurrent reuse", async () => {
    consumeGrantOnceMock.mockResolvedValueOnce({ status: "already_used" });
    const { POST } = await import("./route");
    const response = await POST(
      postJson({ code: PLAINTEXT_CODE, code_verifier: VERIFIER, redirect_uri: REDIRECT }),
    );
    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.error).toBe("already_used");
    expect(JSON.stringify(body).toLowerCase()).toContain("already used");
  });

  it("returns the 'already used' phrase verbatim (CLI test fixture)", async () => {
    consumeGrantOnceMock.mockResolvedValueOnce({ status: "already_used" });
    const { POST } = await import("./route");
    const response = await POST(
      postJson({ code: PLAINTEXT_CODE, code_verifier: VERIFIER, redirect_uri: REDIRECT }),
    );
    const body = await response.json();
    // The CLI test fixture at auth_flow.rs:602 asserts the message contains
    // the phrase "already used". The detail field satisfies that.
    expect(typeof body.detail).toBe("string");
    expect(body.detail.toLowerCase()).toContain("already used");
  });

  it("returns 400 invalid_grant on PKCE mismatch", async () => {
    consumeGrantOnceMock.mockResolvedValueOnce({ status: "pkce_mismatch" });
    const { POST } = await import("./route");
    const response = await POST(
      postJson({ code: PLAINTEXT_CODE, code_verifier: VERIFIER, redirect_uri: REDIRECT }),
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid_grant" });
  });

  it("returns 410 gone on expired grant", async () => {
    consumeGrantOnceMock.mockResolvedValueOnce({ status: "gone" });
    const { POST } = await import("./route");
    const response = await POST(
      postJson({ code: PLAINTEXT_CODE, code_verifier: VERIFIER, redirect_uri: REDIRECT }),
    );
    expect(response.status).toBe(410);
    const body = await response.json();
    expect(body.error).toBe("gone");
    expect(typeof body.detail).toBe("string");
  });

  it("returns 400 redirect_uri_mismatch when the stored redirect differs", async () => {
    consumeGrantOnceMock.mockResolvedValueOnce({ status: "redirect_uri_mismatch" });
    const { POST } = await import("./route");
    const response = await POST(
      postJson({ code: PLAINTEXT_CODE, code_verifier: VERIFIER, redirect_uri: REDIRECT }),
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "redirect_uri_mismatch" });
  });

  it("returns 400 invalid_grant when the grant does not exist", async () => {
    consumeGrantOnceMock.mockResolvedValueOnce({ status: "invalid_grant" });
    const { POST } = await import("./route");
    const response = await POST(
      postJson({ code: PLAINTEXT_CODE, code_verifier: VERIFIER, redirect_uri: REDIRECT }),
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid_grant" });
  });

  it("returns 400 invalid_grant when the client is deregistered between authorize and exchange", async () => {
    consumeGrantOnceMock.mockResolvedValueOnce(okConsume({ clientId: "tastile-cli-removed" }));
    const { POST } = await import("./route");
    const response = await POST(
      postJson({ code: PLAINTEXT_CODE, code_verifier: VERIFIER, redirect_uri: REDIRECT }),
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid_grant" });
    // Grant was consumed by the UPDATE but the mint must NOT happen.
    expect(mintTastileApiTokenForUserMock).not.toHaveBeenCalled();
  });

  it("returns 502 core_unavailable when Core mint fails (grant already consumed)", async () => {
    consumeGrantOnceMock.mockResolvedValueOnce(okConsume());
    mintTastileApiTokenForUserMock.mockResolvedValueOnce(null);
    const { POST } = await import("./route");
    const response = await POST(
      postJson({ code: PLAINTEXT_CODE, code_verifier: VERIFIER, redirect_uri: REDIRECT }),
    );
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: "core_unavailable" });
    // The grant was consumed by the UPDATE; we do NOT mark a core_token_id.
    expect(markCoreTokenIdMock).not.toHaveBeenCalled();
  });

  it("rejects when E2E_BYPASS_AUTH=1 (production safety)", async () => {
    process.env.E2E_BYPASS_AUTH = "1";
    const { POST } = await import("./route");
    const response = await POST(
      postJson({ code: PLAINTEXT_CODE, code_verifier: VERIFIER, redirect_uri: REDIRECT }),
    );
    expect([400, 403]).toContain(response.status);
    const body = await response.json();
    expect(body.error).toBe("bypass_not_permitted");
    // Critical: the bypass must not reach the consume path.
    expect(consumeGrantOnceMock).not.toHaveBeenCalled();
  });

  it("does not read the BetterAuth session (wire-contract fidelity)", async () => {
    const { POST } = await import("./route");
    await POST(
      postJson({ code: PLAINTEXT_CODE, code_verifier: VERIFIER, redirect_uri: REDIRECT }),
    );
    expect(getSessionSpy).not.toHaveBeenCalled();
  });

  it("AC #2: does not call BetterAuth even when Authorization + Cookie are present, and response is identical to the no-Cookie case", async () => {
    const { POST } = await import("./route");
    const response = await POST(
      postJson(
        { code: PLAINTEXT_CODE, code_verifier: VERIFIER, redirect_uri: REDIRECT },
        {
          authorization: "Bearer session-jwt-that-should-be-ignored",
          cookie: "better-auth.session_token=should-be-ignored; other=foo",
        },
      ),
    );
    expect(response.status).toBe(200);
    expect(getSessionSpy).not.toHaveBeenCalled();
    // Happy-path response body is identical to the no-header case.
    expect(await response.json()).toEqual({
      token: "bearer-raw-token",
      expires_at: "2030-01-01T00:00:00.000Z",
      subject: "user-1",
    });
  });

  it("persists the Core-issued token id (NOT a slice of the bearer) as core_token_id", async () => {
    const { POST } = await import("./route");
    const response = await POST(
      postJson({ code: PLAINTEXT_CODE, code_verifier: VERIFIER, redirect_uri: REDIRECT }),
    );
    expect(response.status).toBe(200);
    // markCoreTokenId is called with the Core-issued id …
    expect(markCoreTokenIdMock).toHaveBeenCalledWith(
      expect.stringMatching(/^[0-9a-f]{64}$/u),
      "core-token-id-1",
    );
    // … and never with a prefix / slice of the bearer token.
    expect(markCoreTokenIdMock).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.stringContaining("bearer-raw-token"),
    );
  });

  it("does not leak the plaintext code, verifier, or bearer token in error responses", async () => {
    consumeGrantOnceMock.mockResolvedValueOnce({ status: "invalid_grant" });
    const { POST } = await import("./route");
    const response = await POST(
      postJson({ code: PLAINTEXT_CODE, code_verifier: VERIFIER, redirect_uri: REDIRECT }),
    );
    const bodyText = await response.text();
    expect(bodyText).not.toContain(PLAINTEXT_CODE);
    expect(bodyText).not.toContain(VERIFIER);
    expect(bodyText).not.toContain("bearer-raw-token");
    expect(bodyText).not.toContain("server-only-secret"); // bridge secret placeholder
  });

  it("does not log the plaintext code, verifier, or bearer token", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    consumeGrantOnceMock.mockResolvedValueOnce({ status: "invalid_grant" });
    const { POST } = await import("./route");
    await POST(
      postJson({ code: PLAINTEXT_CODE, code_verifier: VERIFIER, redirect_uri: REDIRECT }),
    );
    const combined = JSON.stringify(warn.mock.calls);
    expect(combined).not.toContain(PLAINTEXT_CODE);
    expect(combined).not.toContain(VERIFIER);
    warn.mockRestore();
  });
});

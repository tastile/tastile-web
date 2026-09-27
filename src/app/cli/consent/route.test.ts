import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const insertGrantMock = vi.fn();
const generateGrantCodeMock = vi.fn();

vi.mock("@/shared/auth/cli/grant-store", () => ({
  insertGrant: (...args: unknown[]) => insertGrantMock(...args),
}));

vi.mock("@/shared/auth/cli/pkce", () => ({
  generateGrantCode: (...args: unknown[]) => generateGrantCodeMock(...args),
}));

const insertPendingConsentMock = vi.fn();
const loadPendingConsentMock = vi.fn();
const markPendingConsumedMock = vi.fn();

vi.mock("@/shared/auth/cli/pending-consent-store", () => ({
  insertPendingConsent: (...args: unknown[]) => insertPendingConsentMock(...args),
  loadPendingConsent: (...args: unknown[]) => loadPendingConsentMock(...args),
  markPendingConsumed: (...args: unknown[]) => markPendingConsumedMock(...args),
}));

const resolveUserSubMock = vi.fn();

vi.mock("@/shared/auth/authenticated-session", () => ({
  resolveAuthenticatedUserSub: (...args: unknown[]) => resolveUserSubMock(...args),
}));

const ORIGINAL_ENV = process.env;

function postForm(fields: Record<string, string>): NextRequest {
  const body = new URLSearchParams(fields);
  return new NextRequest("https://app.test/cli/consent", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
}

describe("POST /cli/consent", () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    delete process.env.E2E_BYPASS_AUTH;
    insertGrantMock.mockReset();
    generateGrantCodeMock.mockReset();
    insertPendingConsentMock.mockReset();
    loadPendingConsentMock.mockReset();
    markPendingConsumedMock.mockReset();
    resolveUserSubMock.mockReset();
    generateGrantCodeMock.mockReturnValue("grant-code-plaintext");
    insertGrantMock.mockResolvedValue(undefined);
    markPendingConsumedMock.mockResolvedValue(true);
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  it("allow: redirects to redirect_uri with code + state", async () => {
    resolveUserSubMock.mockResolvedValueOnce("user-1");
    loadPendingConsentMock.mockResolvedValueOnce({
      status: "ok",
      userSub: "user-1",
      clientId: "tastile-cli",
      codeChallenge: "challenge-1",
      redirectUri: "http://127.0.0.1:1234/callback",
      scopesEffective: "tastile.read tastile.write",
      state: "csrf-state",
      responseType: "code",
    });
    const { POST } = await import("./route");
    const response = await POST(postForm({ tid: "tid-1", decision: "allow" }));
    expect(response.status).toBe(307);
    const location = response.headers.get("location") ?? "";
    expect(location).toContain("http://127.0.0.1:1234/callback");
    expect(location).toContain("code=grant-code-plaintext");
    expect(location).toContain("state=csrf-state");
    expect(insertGrantMock).toHaveBeenCalledWith(
      expect.objectContaining({ code: "grant-code-plaintext", clientId: "tastile-cli" }),
    );
  });

  it("deny: redirects with error=access_denied + state", async () => {
    resolveUserSubMock.mockResolvedValueOnce("user-1");
    loadPendingConsentMock.mockResolvedValueOnce({
      status: "ok",
      userSub: "user-1",
      clientId: "tastile-cli",
      codeChallenge: "challenge-1",
      redirectUri: "http://127.0.0.1:1234/callback",
      scopesEffective: "tastile.read",
      state: "csrf-state",
      responseType: "code",
    });
    const { POST } = await import("./route");
    const response = await POST(postForm({ tid: "tid-1", decision: "deny" }));
    expect(response.status).toBe(307);
    const location = response.headers.get("location") ?? "";
    expect(location).toContain("error=access_denied");
    expect(location).toContain("state=csrf-state");
    // Grant must NOT be inserted on deny.
    expect(insertGrantMock).not.toHaveBeenCalled();
  });

  it("returns 410 when pending consent is missing", async () => {
    resolveUserSubMock.mockResolvedValueOnce("user-1");
    loadPendingConsentMock.mockResolvedValueOnce({ status: "missing" });
    const { POST } = await import("./route");
    const response = await POST(postForm({ tid: "tid-x", decision: "allow" }));
    expect(response.status).toBe(410);
  });

  it("returns 410 when pending consent is expired", async () => {
    resolveUserSubMock.mockResolvedValueOnce("user-1");
    loadPendingConsentMock.mockResolvedValueOnce({ status: "expired" });
    const { POST } = await import("./route");
    const response = await POST(postForm({ tid: "tid-x", decision: "allow" }));
    expect(response.status).toBe(410);
  });

  it("returns 410 when pending consent is already consumed (replay)", async () => {
    resolveUserSubMock.mockResolvedValueOnce("user-1");
    loadPendingConsentMock.mockResolvedValueOnce({ status: "consumed" });
    const { POST } = await import("./route");
    const response = await POST(postForm({ tid: "tid-x", decision: "allow" }));
    expect(response.status).toBe(410);
  });

  it("returns 403 when the resolved session does not match the row's user_sub", async () => {
    resolveUserSubMock.mockResolvedValueOnce("user-1");
    loadPendingConsentMock.mockResolvedValueOnce({
      status: "ok",
      userSub: "user-2", // mismatch
      clientId: "tastile-cli",
      codeChallenge: "challenge-1",
      redirectUri: "http://127.0.0.1:1234/callback",
      scopesEffective: "tastile.read",
      state: "csrf-state",
      responseType: "code",
    });
    const { POST } = await import("./route");
    const response = await POST(postForm({ tid: "tid-1", decision: "allow" }));
    expect(response.status).toBe(403);
    expect(markPendingConsumedMock).not.toHaveBeenCalled();
  });

  it("returns 410 when markPendingConsumed reports a race (returns false)", async () => {
    resolveUserSubMock.mockResolvedValueOnce("user-1");
    loadPendingConsentMock.mockResolvedValueOnce({
      status: "ok",
      userSub: "user-1",
      clientId: "tastile-cli",
      codeChallenge: "challenge-1",
      redirectUri: "http://127.0.0.1:1234/callback",
      scopesEffective: "tastile.read",
      state: "csrf-state",
      responseType: "code",
    });
    markPendingConsumedMock.mockResolvedValueOnce(false);
    const { POST } = await import("./route");
    const response = await POST(postForm({ tid: "tid-1", decision: "allow" }));
    expect(response.status).toBe(410);
    expect(insertGrantMock).not.toHaveBeenCalled();
  });

  it("returns 401 when the user is not authenticated", async () => {
    resolveUserSubMock.mockResolvedValueOnce(null);
    const { POST } = await import("./route");
    const response = await POST(postForm({ tid: "tid-1", decision: "allow" }));
    expect(response.status).toBe(401);
    expect(loadPendingConsentMock).not.toHaveBeenCalled();
  });

  it("does not leak code / state / verifier in error response bodies", async () => {
    resolveUserSubMock.mockResolvedValueOnce("user-1");
    loadPendingConsentMock.mockResolvedValueOnce({ status: "missing" });
    const { POST } = await import("./route");
    const response = await POST(postForm({ tid: "tid-with-secret", decision: "allow" }));
    const text = await response.text();
    // `tid-with-secret` is harmless to log; the assertion is that no
    // plaintext code / verifier / bearer appear in the response body.
    expect(text).not.toContain("grant-code-plaintext");
    expect(text).not.toContain("bearer-raw-token");
  });

  it("does not log the plaintext code or state", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    resolveUserSubMock.mockResolvedValueOnce("user-1");
    loadPendingConsentMock.mockResolvedValueOnce({
      status: "ok",
      userSub: "user-1",
      clientId: "tastile-cli",
      codeChallenge: "challenge-1",
      redirectUri: "http://127.0.0.1:1234/callback",
      scopesEffective: "tastile.read",
      state: "secret-csrf-state-do-not-log",
      responseType: "code",
    });
    const { POST } = await import("./route");
    await POST(postForm({ tid: "tid-1", decision: "allow" }));
    const combined = JSON.stringify(warn.mock.calls);
    expect(combined).not.toContain("secret-csrf-state-do-not-log");
    expect(combined).not.toContain("grant-code-plaintext");
    warn.mockRestore();
  });
});

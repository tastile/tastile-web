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
const atomicConsumePendingConsentMock = vi.fn();

vi.mock("@/shared/auth/cli/pending-consent-store", () => ({
  insertPendingConsent: (...args: unknown[]) => insertPendingConsentMock(...args),
  atomicConsumePendingConsent: (...args: unknown[]) =>
    atomicConsumePendingConsentMock(...args),
}));

const resolveUserSubMock = vi.fn();

vi.mock("@/shared/auth/authenticated-session", () => ({
  resolveAuthenticatedUserSub: (...args: unknown[]) => resolveUserSubMock(...args),
}));

const ORIGINAL_ENV = process.env;

function postForm(fields: Record<string, string>): NextRequest {
  const body = new URLSearchParams(fields);
  return new NextRequest("https://app.test/cli/consent/submit", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
}

function okConsume(overrides: Partial<{ userSub: string; clientId: string; codeChallenge: string; redirectUri: string; scopesEffective: string; state: string; responseType: string }> = {}) {
  return {
    status: "ok" as const,
    userSub: overrides.userSub ?? "user-1",
    clientId: overrides.clientId ?? "tastile-cli",
    codeChallenge: overrides.codeChallenge ?? "challenge-1",
    redirectUri: overrides.redirectUri ?? "http://127.0.0.1:1234/callback",
    scopesEffective: overrides.scopesEffective ?? "tastile.read tastile.write",
    state: overrides.state ?? "csrf-state",
    responseType: overrides.responseType ?? "code",
  };
}

describe("POST /cli/consent/submit", () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    delete process.env.E2E_BYPASS_AUTH;
    insertGrantMock.mockReset();
    generateGrantCodeMock.mockReset();
    insertPendingConsentMock.mockReset();
    atomicConsumePendingConsentMock.mockReset();
    resolveUserSubMock.mockReset();
    generateGrantCodeMock.mockReturnValue("grant-code-plaintext");
    insertGrantMock.mockResolvedValue(undefined);
    atomicConsumePendingConsentMock.mockResolvedValue(okConsume());
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  it("allow: redirects to redirect_uri with code + state", async () => {
    resolveUserSubMock.mockResolvedValueOnce("user-1");
    atomicConsumePendingConsentMock.mockResolvedValueOnce(okConsume());
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
    atomicConsumePendingConsentMock.mockResolvedValueOnce(
      okConsume({ scopesEffective: "tastile.read" }),
    );
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
    atomicConsumePendingConsentMock.mockResolvedValueOnce({ status: "missing" });
    const { POST } = await import("./route");
    const response = await POST(postForm({ tid: "tid-x", decision: "allow" }));
    expect(response.status).toBe(410);
  });

  it("returns 410 when pending consent is expired", async () => {
    resolveUserSubMock.mockResolvedValueOnce("user-1");
    atomicConsumePendingConsentMock.mockResolvedValueOnce({ status: "expired" });
    const { POST } = await import("./route");
    const response = await POST(postForm({ tid: "tid-x", decision: "allow" }));
    expect(response.status).toBe(410);
  });

  it("returns 410 when pending consent is already consumed (replay)", async () => {
    resolveUserSubMock.mockResolvedValueOnce("user-1");
    atomicConsumePendingConsentMock.mockResolvedValueOnce({ status: "consumed" });
    const { POST } = await import("./route");
    const response = await POST(postForm({ tid: "tid-x", decision: "allow" }));
    expect(response.status).toBe(410);
  });

  it("returns 403 when the resolved session does not match the row's user_sub", async () => {
    resolveUserSubMock.mockResolvedValueOnce("user-1");
    atomicConsumePendingConsentMock.mockResolvedValueOnce({
      status: "user_mismatch",
      storedUserSub: "user-2",
    });
    const { POST } = await import("./route");
    const response = await POST(postForm({ tid: "tid-1", decision: "allow" }));
    expect(response.status).toBe(403);
    expect(insertGrantMock).not.toHaveBeenCalled();
  });

  it("returns 401 when the user is not authenticated", async () => {
    resolveUserSubMock.mockResolvedValueOnce(null);
    const { POST } = await import("./route");
    const response = await POST(postForm({ tid: "tid-1", decision: "allow" }));
    expect(response.status).toBe(401);
    expect(atomicConsumePendingConsentMock).not.toHaveBeenCalled();
  });

  it("does not leak code / state / verifier in error response bodies", async () => {
    resolveUserSubMock.mockResolvedValueOnce("user-1");
    atomicConsumePendingConsentMock.mockResolvedValueOnce({ status: "missing" });
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
    atomicConsumePendingConsentMock.mockResolvedValueOnce(
      okConsume({
        scopesEffective: "tastile.read",
        state: "secret-csrf-state-do-not-log",
      }),
    );
    const { POST } = await import("./route");
    await POST(postForm({ tid: "tid-1", decision: "allow" }));
    const combined = JSON.stringify(warn.mock.calls);
    expect(combined).not.toContain("secret-csrf-state-do-not-log");
    expect(combined).not.toContain("grant-code-plaintext");
    warn.mockRestore();
  });

  it("rejects when E2E_BYPASS_AUTH=1 (production safety)", async () => {
    process.env.E2E_BYPASS_AUTH = "1";
    const { POST } = await import("./route");
    const response = await POST(postForm({ tid: "tid-1", decision: "allow" }));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "bypass_not_permitted" });
    expect(atomicConsumePendingConsentMock).not.toHaveBeenCalled();
    expect(insertGrantMock).not.toHaveBeenCalled();
  });

  it("calls atomicConsumePendingConsent with the tid and resolved user_sub", async () => {
    resolveUserSubMock.mockResolvedValueOnce("user-1");
    atomicConsumePendingConsentMock.mockResolvedValueOnce(okConsume());
    const { POST } = await import("./route");
    await POST(postForm({ tid: "tid-1", decision: "allow" }));
    expect(atomicConsumePendingConsentMock).toHaveBeenCalledWith("tid-1", "user-1");
  });
});
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ORIGINAL_ENV = { ...process.env };

describe("makeClient (api/v1/submit.ts)", () => {
  beforeEach(() => {
    vi.resetModules();
    Object.assign(process.env, { ...ORIGINAL_ENV });
  });

  afterEach(() => {
    Object.assign(process.env, { ...ORIGINAL_ENV });
  });

  it("returns the E2E dev token when NEXT_PUBLIC_E2E_BYPASS_AUTH=1", async () => {
    process.env.NEXT_PUBLIC_E2E_BYPASS_AUTH = "1";
    const { makeClient } = await import("./submit");
    const client = makeClient();
    expect(client.useProxyBridge).toBe(true);
    expect(client.baseUrl).toBe("/api/proxy/v1");
    await expect(client.getIdToken()).resolves.toBe("e2e-bypass-token");
  });

  it("returns null (no Cognito token material) when not in E2E bypass mode", async () => {
    delete process.env.NEXT_PUBLIC_E2E_BYPASS_AUTH;
    const { makeClient } = await import("./submit");
    const client = makeClient();
    // Browser code MUST NEVER receive a Cognito id_token or refresh_token.
    // When the proxy bridge is in use, auth is added server-side; this
    // hook is intentionally a no-op for direct local calls.
    await expect(client.getIdToken()).resolves.toBeNull();
  });
});

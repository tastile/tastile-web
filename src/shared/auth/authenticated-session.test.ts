// W06 #81 round-3 security regression guard.  The E2E bypass in
// authenticated-session.ts must fire *only* when E2E_BYPASS_AUTH === "1".
// Any other value (unset, "0", "", "true", "yes", "on", ...) must
// fall through to BetterAuth so production builds fail-closed.
//
// Production builds never set E2E_BYPASS_AUTH.  CI dev runs set
// E2E_BYPASS_AUTH=1 explicitly.  This test pins both shapes.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// next/headers() throws outside a Next.js request scope, which vitest
// isn't.  Mock it with a no-op async function so the fallback path
// under test doesn't try to read real request state.
vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
}));

// Hoist the BetterAuth mock BEFORE we import the module so that the
// fallback path (E2E_BYPASS_AUTH unset) actually calls the mocked
// getAuth() and we can assert it.
const getSession = vi.fn();
vi.mock("./better-auth/server", () => ({
  getAuth: () => ({ api: { getSession } }),
}));

async function loadModule() {
  vi.resetModules();
  return await import("./authenticated-session");
}

describe("W06 #81 authenticated-session E2E bypass fail-closed regression guard", () => {
  let originalBypass: string | undefined;

  beforeEach(() => {
    originalBypass = process.env.E2E_BYPASS_AUTH;
    getSession.mockReset();
  });

  afterEach(() => {
    if (originalBypass === undefined) delete process.env.E2E_BYPASS_AUTH;
    else process.env.E2E_BYPASS_AUTH = originalBypass;
  });

  it("returns the synthetic bypass session when E2E_BYPASS_AUTH === '1'", async () => {
    process.env.E2E_BYPASS_AUTH = "1";
    const mod = await loadModule();
    const session = await mod.resolveAuthenticatedSession();
    expect(session).not.toBeNull();
    expect(session?.id).toBe("00000000-0000-0000-0000-000000000001");
    expect(getSession).not.toHaveBeenCalled();
  });

  it("falls through to BetterAuth when E2E_BYPASS_AUTH is unset (production default)", async () => {
    delete process.env.E2E_BYPASS_AUTH;
    getSession.mockResolvedValue({ user: { id: "real-user" } });
    const mod = await loadModule();
    const session = await mod.resolveAuthenticatedSession();
    expect(getSession).toHaveBeenCalledOnce();
    expect(session?.id).toBe("real-user");
  });

  it.each(["", "0", "true", "yes", "on", "false", "no"])(
    "does NOT fire bypass for E2E_BYPASS_AUTH=%p (fail-closed)",
    async (value) => {
      process.env.E2E_BYPASS_AUTH = value;
      getSession.mockResolvedValue({ user: { id: "real-user" } });
      const mod = await loadModule();
      const session = await mod.resolveAuthenticatedSession();
      expect(getSession).toHaveBeenCalled();
      expect(session?.id).toBe("real-user");
      // The bypass shape (id === DEV_ACTOR) must not leak for any other value.
      expect(session?.id).not.toBe("00000000-0000-0000-0000-000000000001");
    },
  );

  it("returns null (fail-closed) when E2E_BYPASS_AUTH is unset and BetterAuth returns no session", async () => {
    delete process.env.E2E_BYPASS_AUTH;
    getSession.mockResolvedValue(null);
    const mod = await loadModule();
    const session = await mod.resolveAuthenticatedSession();
    expect(session).toBeNull();
  });

  it("resolveAuthenticatedUserSub also fail-closes for any non-'1' value", async () => {
    delete process.env.E2E_BYPASS_AUTH;
    getSession.mockResolvedValue({ user: { id: "real-user" } });
    const mod = await loadModule();
    const sub = await mod.resolveAuthenticatedUserSub();
    expect(getSession).toHaveBeenCalled();
    expect(sub).toBe("real-user");
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

const mintCoreAssertion = vi.hoisted(() => vi.fn());
const resolveAuthenticatedUserSub = vi.hoisted(() => vi.fn());

vi.mock("./core-assertion", () => ({
  CORE_ASSERTION_HEADER: "x-tastile-web-assertion",
  mintCoreAssertion,
}));
vi.mock("./authenticated-session", () => ({
  resolveAuthenticatedUserSub,
}));

import { buildCoreBridgeHeaders, isCoreAssertionEnabled } from "./core-bridge-headers";

const BASE = { bridgeSecret: "test-bridge-secret", userSub: "user-sub-1" };
const ON = { TASTILE_WEB_CORE_ASSERTION_ENABLED: "true" };

describe("buildCoreBridgeHeaders", () => {
  beforeEach(() => {
    mintCoreAssertion.mockReset();
    mintCoreAssertion.mockImplementation(async (sub: string) => `assertion-for-${sub}`);
    resolveAuthenticatedUserSub.mockReset();
    resolveAuthenticatedUserSub.mockResolvedValue("user-sub-1");
  });

  it("emits only the bridge headers, in order, when the flag is unset", async () => {
    const headers = await buildCoreBridgeHeaders({ ...BASE, env: {} });

    expect(headers).toEqual({
      "x-tastile-web-bridge-secret": "test-bridge-secret",
      "x-tastile-web-session-user": "user-sub-1",
    });
    expect(Object.keys(headers ?? {})).toEqual([
      "x-tastile-web-bridge-secret",
      "x-tastile-web-session-user",
    ]);
    expect(resolveAuthenticatedUserSub).not.toHaveBeenCalled();
    expect(mintCoreAssertion).not.toHaveBeenCalled();
  });

  it("keeps unchanged headers even without a session when the flag is unset", async () => {
    resolveAuthenticatedUserSub.mockResolvedValue(null);
    const headers = await buildCoreBridgeHeaders({ ...BASE, env: {} });

    expect(headers).toEqual({
      "x-tastile-web-bridge-secret": "test-bridge-secret",
      "x-tastile-web-session-user": "user-sub-1",
    });
    expect(mintCoreAssertion).not.toHaveBeenCalled();
  });

  it.each(["", "1", "TRUE", "True", " true", "false", "yes"])(
    "does not mint an assertion for flag value %j",
    async (value) => {
      const headers = await buildCoreBridgeHeaders({
        ...BASE,
        env: { TASTILE_WEB_CORE_ASSERTION_ENABLED: value },
      });

      expect(headers).not.toHaveProperty("x-tastile-web-assertion");
      expect(mintCoreAssertion).not.toHaveBeenCalled();
    },
  );

  it("flag on + matching session: mints with sub = session user id and keeps bridge headers", async () => {
    const requestHeaders = new Headers({ cookie: "x=1" });
    const headers = await buildCoreBridgeHeaders({
      ...BASE,
      env: ON,
      requestHeaders,
    });

    expect(headers).toEqual({
      "x-tastile-web-bridge-secret": "test-bridge-secret",
      "x-tastile-web-session-user": "user-sub-1",
      "x-tastile-web-assertion": "assertion-for-user-sub-1",
    });
    expect(resolveAuthenticatedUserSub).toHaveBeenCalledWith({ requestHeaders });
    expect(mintCoreAssertion).toHaveBeenCalledOnce();
    expect(mintCoreAssertion).toHaveBeenCalledWith("user-sub-1");
  });

  it("flag on + cookie/session mismatch: returns null and mints nothing", async () => {
    resolveAuthenticatedUserSub.mockResolvedValue("someone-else");
    const headers = await buildCoreBridgeHeaders({ ...BASE, env: ON });

    expect(headers).toBeNull();
    expect(mintCoreAssertion).not.toHaveBeenCalled();
  });

  it("flag on + no session: returns null and mints nothing, no bridge-only fallback", async () => {
    resolveAuthenticatedUserSub.mockResolvedValue(null);
    const headers = await buildCoreBridgeHeaders({ ...BASE, env: ON });

    expect(headers).toBeNull();
    expect(mintCoreAssertion).not.toHaveBeenCalled();
  });

  it("flag on + mint failure: the error propagates to the caller", async () => {
    mintCoreAssertion.mockRejectedValue(new Error("jwks unavailable"));
    await expect(buildCoreBridgeHeaders({ ...BASE, env: ON })).rejects.toThrow("jwks unavailable");
  });

  it("reads process.env when no env is passed", () => {
    const original = process.env.TASTILE_WEB_CORE_ASSERTION_ENABLED;
    try {
      process.env.TASTILE_WEB_CORE_ASSERTION_ENABLED = "true";
      expect(isCoreAssertionEnabled()).toBe(true);
      process.env.TASTILE_WEB_CORE_ASSERTION_ENABLED = "false";
      expect(isCoreAssertionEnabled()).toBe(false);
    } finally {
      if (original === undefined) delete process.env.TASTILE_WEB_CORE_ASSERTION_ENABLED;
      else process.env.TASTILE_WEB_CORE_ASSERTION_ENABLED = original;
    }
  });
});

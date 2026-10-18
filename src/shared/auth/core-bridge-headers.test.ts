import { beforeEach, describe, expect, it, vi } from "vitest";

const mintCoreAssertion = vi.hoisted(() => vi.fn());

vi.mock("./core-assertion", () => ({
  CORE_ASSERTION_HEADER: "x-tastile-web-assertion",
  mintCoreAssertion,
}));

import {
  buildCoreBridgeHeaders,
  isCoreAssertionEnabled,
} from "./core-bridge-headers";

const BASE = { bridgeSecret: "test-bridge-secret", userSub: "user-sub-1" };

describe("buildCoreBridgeHeaders", () => {
  beforeEach(() => {
    mintCoreAssertion.mockReset();
    mintCoreAssertion.mockImplementation(async (sub: string) => `assertion-for-${sub}`);
  });

  it("emits only the bridge headers when the flag is unset", async () => {
    const headers = await buildCoreBridgeHeaders({ ...BASE, env: {} });

    expect(headers).toEqual({
      "x-tastile-web-bridge-secret": "test-bridge-secret",
      "x-tastile-web-session-user": "user-sub-1",
    });
    expect(Object.keys(headers)).toEqual([
      "x-tastile-web-bridge-secret",
      "x-tastile-web-session-user",
    ]);
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

  it("adds the assertion and keeps the bridge headers when the flag is exactly true", async () => {
    const headers = await buildCoreBridgeHeaders({
      ...BASE,
      env: { TASTILE_WEB_CORE_ASSERTION_ENABLED: "true" },
    });

    expect(headers).toEqual({
      "x-tastile-web-bridge-secret": "test-bridge-secret",
      "x-tastile-web-session-user": "user-sub-1",
      "x-tastile-web-assertion": "assertion-for-user-sub-1",
    });
    expect(mintCoreAssertion).toHaveBeenCalledOnce();
    expect(mintCoreAssertion).toHaveBeenCalledWith("user-sub-1");
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

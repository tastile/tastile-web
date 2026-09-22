import { afterEach, describe, expect, it } from "vitest";

import { isE2EBypassEnabled, isProtectedWebRuntime } from "./runtime-env";

const originalEnvironment = process.env.TASTILE_ENV;
const originalBypass = process.env.E2E_BYPASS_AUTH;

afterEach(() => {
  if (originalEnvironment === undefined) delete process.env.TASTILE_ENV;
  else process.env.TASTILE_ENV = originalEnvironment;
  if (originalBypass === undefined) delete process.env.E2E_BYPASS_AUTH;
  else process.env.E2E_BYPASS_AUTH = originalBypass;
});

describe("runtime environment guards", () => {
  it.each(["preview", "staging", "production", "prod"])(
    "protects the %s runtime from E2E auth bypass",
    (environment) => {
      process.env.TASTILE_ENV = environment;
      process.env.E2E_BYPASS_AUTH = "1";

      expect(isProtectedWebRuntime()).toBe(true);
      expect(isE2EBypassEnabled()).toBe(false);
    },
  );

  it("allows the explicit bypass only outside protected environments", () => {
    process.env.TASTILE_ENV = "development";
    process.env.E2E_BYPASS_AUTH = "1";

    expect(isProtectedWebRuntime()).toBe(false);
    expect(isE2EBypassEnabled()).toBe(true);
  });

  it("fails closed for an unknown runtime environment", () => {
    process.env.TASTILE_ENV = "staginng";
    process.env.E2E_BYPASS_AUTH = "1";

    expect(isProtectedWebRuntime()).toBe(true);
    expect(isE2EBypassEnabled()).toBe(false);
  });

  it("fails closed when the runtime environment is unset", () => {
    delete process.env.TASTILE_ENV;
    process.env.E2E_BYPASS_AUTH = "1";

    expect(isProtectedWebRuntime()).toBe(true);
    expect(isE2EBypassEnabled()).toBe(false);
  });
});

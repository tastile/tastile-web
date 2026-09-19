// W06 #81 round-3 security regression guard.  The STRIPE_API_HOST /
// STRIPE_API_PORT / STRIPE_API_PROTOCOL environment overrides on
// getStripe() are dev-only.  When unset (production default), the
// returned Stripe client must keep the api.stripe.com + https + 443
// defaults.  This test fails-closed if a future refactor accidentally
// hardcodes a localhost override or drops the protocol field.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// We don't import the Stripe SDK here — we stub the constructor and
// capture the config object so we can assert on the actual values
// getStripe() would pass.
const StripeCtor = vi.fn();
interface CapturedConfig {
  apiVersion?: string;
  host?: string;
  port?: string | number;
  protocol?: string;
  _api?: unknown;
}
vi.mock("stripe", () => ({
  default: function StripeStub(
    this: { _api?: unknown; billingPortal: { sessions: { create: ReturnType<typeof vi.fn> } } },
    key: string,
    config: CapturedConfig,
  ) {
    StripeCtor(key, config);
    this._api = config._api;
    this.billingPortal = { sessions: { create: vi.fn() } };
  },
}));

async function loadModule() {
  vi.resetModules();
  return await import("./stripe");
}

describe("W06 #81 Stripe env override production-default regression guard", () => {
  let originalEnv: Record<string, string | undefined>;

  beforeEach(() => {
    originalEnv = {
      STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
      STRIPE_API_HOST: process.env.STRIPE_API_HOST,
      STRIPE_API_PORT: process.env.STRIPE_API_PORT,
      STRIPE_API_PROTOCOL: process.env.STRIPE_API_PROTOCOL,
    };
    StripeCtor.mockClear();
  });

  afterEach(() => {
    for (const [k, v] of Object.entries(originalEnv)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  it("throws Missing STRIPE_SECRET_KEY when key is unset", async () => {
    delete process.env.STRIPE_SECRET_KEY;
    const { getStripe } = await loadModule();
    expect(() => getStripe()).toThrow(/Missing STRIPE_SECRET_KEY/);
    expect(StripeCtor).not.toHaveBeenCalled();
  });

  it("uses production api.stripe.com defaults when no override env is set", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_prod_defaults";
    delete process.env.STRIPE_API_HOST;
    delete process.env.STRIPE_API_PORT;
    delete process.env.STRIPE_API_PROTOCOL;
    const { getStripe } = await loadModule();
    getStripe();
    expect(StripeCtor).toHaveBeenCalledOnce();
    const [, config] = StripeCtor.mock.calls[0] as [string, Record<string, unknown>];
    expect(config).toMatchObject({
      apiVersion: "2026-08-26.dahlia",
    });
    // host / port / protocol must NOT be in the config when env is unset
    expect(config).not.toHaveProperty("host");
    expect(config).not.toHaveProperty("port");
    expect(config).not.toHaveProperty("protocol");
  });

  it("respects STRIPE_API_HOST / PORT / PROTOCOL when set", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_overrides";
    process.env.STRIPE_API_HOST = "127.0.0.1";
    process.env.STRIPE_API_PORT = "8080";
    process.env.STRIPE_API_PROTOCOL = "http";
    const { getStripe } = await loadModule();
    getStripe();
    expect(StripeCtor).toHaveBeenCalledOnce();
    const [, config] = StripeCtor.mock.calls[0] as [string, Record<string, unknown>];
    expect(config).toMatchObject({
      apiVersion: "2026-08-26.dahlia",
      host: "127.0.0.1",
      port: "8080",
      protocol: "http",
    });
  });

  it("ignores empty-string env overrides (treats as unset, fail-closed default)", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_empty";
    process.env.STRIPE_API_HOST = "";
    process.env.STRIPE_API_PORT = "";
    process.env.STRIPE_API_PROTOCOL = "";
    const { getStripe } = await loadModule();
    getStripe();
    const [, config] = StripeCtor.mock.calls[0] as [string, Record<string, unknown>];
    expect(config).not.toHaveProperty("host");
    expect(config).not.toHaveProperty("port");
    expect(config).not.toHaveProperty("protocol");
  });
});

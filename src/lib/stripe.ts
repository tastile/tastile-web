import Stripe from "stripe";

let cachedStripe: Stripe | null = null;
let cachedSecretKey: string | null = null;
let cachedHost: string | null = null;
let cachedPort: string | null = null;

export function getStripe(): Stripe {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
  if (!secretKey) {
    throw new Error("Missing STRIPE_SECRET_KEY");
  }

  // W06 #81 release-evidence hook: STRIPE_API_HOST / STRIPE_API_PORT /
  // STRIPE_API_PROTOCOL let integration tests redirect the Stripe SDK
  // at a local mock server (see src/app/api/stripe/portal/integration
  // .test.ts) so the 200 path can be exercised end-to-end without
  // operator secrets.  Defaults keep the production api.stripe.com
  // host on https.
  const apiHost = process.env.STRIPE_API_HOST?.trim() || undefined;
  const apiPort = process.env.STRIPE_API_PORT?.trim() || undefined;
  const apiProtocol = process.env.STRIPE_API_PROTOCOL?.trim() || undefined;

  if (
    cachedStripe &&
    cachedSecretKey === secretKey &&
    cachedHost === (apiHost ?? null) &&
    cachedPort === (apiPort ?? null) &&
    (cachedStripe as unknown as { _api?: { protocol: string } })._api
      ?.protocol === (apiProtocol ?? "https")
  ) {
    return cachedStripe;
  }

  cachedStripe = new Stripe(secretKey, {
    apiVersion: "2026-08-26.dahlia",
    ...(apiHost ? { host: apiHost } : {}),
    ...(apiPort ? { port: apiPort } : {}),
    ...(apiProtocol ? { protocol: apiProtocol as "http" | "https" } : {}),
  });
  cachedSecretKey = secretKey;
  cachedHost = apiHost ?? null;
  cachedPort = apiPort ?? null;
  return cachedStripe;
}

function requireEnv(name: "STRIPE_PRO_MONTHLY_PRICE_ID" | "STRIPE_PRO_YEARLY_PRICE_ID"): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing ${name}`);
  }
  return value;
}

export function getPlans() {
  return {
    free: { name: "Free", priceId: null },
    pro_monthly: {
      // display-only: matches live $4.00/month price (actual charge is via Stripe price ID)
      name: "Pro (Monthly)",
      priceId: requireEnv("STRIPE_PRO_MONTHLY_PRICE_ID"),
      amount: 400,
    },
    pro_yearly: {
      // display-only: matches live $40.00/year price (actual charge is via Stripe price ID)
      name: "Pro (Yearly)",
      priceId: requireEnv("STRIPE_PRO_YEARLY_PRICE_ID"),
      amount: 4000,
    },
  } as const;
}

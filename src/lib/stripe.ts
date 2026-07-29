import Stripe from "stripe";

let cachedStripe: Stripe | null = null;
let cachedSecretKey: string | null = null;

export function getStripe(): Stripe {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
  if (!secretKey) {
    throw new Error("Missing STRIPE_SECRET_KEY");
  }

  if (cachedStripe && cachedSecretKey === secretKey) {
    return cachedStripe;
  }

  cachedStripe = new Stripe(secretKey, {
    apiVersion: "2025-02-24.acacia",
  });
  cachedSecretKey = secretKey;
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

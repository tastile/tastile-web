import { getStripe } from "@/lib/stripe";
import type Stripe from "stripe";

type SubscriptionInterval = "monthly" | "yearly";

export type SubscriptionState =
  | { status: "free" }
  | {
      status: "active" | "trialing" | "past_due" | "canceled" | "incomplete" | "unpaid";
      interval: SubscriptionInterval;
      priceId: string;
      customerId: string;
      currentPeriodEnd: number;
      cancelAtPeriodEnd: boolean;
    };

const CACHE_TTL_MS = 60_000;
const cache = new Map<string, { state: SubscriptionState; expiresAt: number }>();

export function invalidateSubscriptionCache(userSubject?: string): void {
  if (!userSubject) {
    cache.clear();
    return;
  }
  cache.delete(userSubject);
}

function intervalForPriceId(priceId: string | undefined): SubscriptionInterval {
  if (!priceId) return "monthly";
  const yearly = process.env.STRIPE_PRO_YEARLY_PRICE_ID?.trim();
  if (yearly && priceId === yearly) return "yearly";
  return "monthly";
}

function escapeCustomerSearchValue(value: string): string {
  // Stripe search query: wrap value in single quotes and escape internal ones.
  return `'${value.replace(/'/g, "'")}'`;
}

async function lookupCustomerBySub(
  stripe: Stripe,
  userSubject: string,
): Promise<Stripe.Customer | null> {
  const result = await stripe.customers.search({
    query: `metadata['tastile_user_id']:${escapeCustomerSearchValue(userSubject)}`,
    limit: 1,
  });
  return result.data[0] ?? null;
}

async function fetchSubscriptionFromStripe(userSubject: string): Promise<SubscriptionState> {
  const stripe = getStripe();
  const customer = await lookupCustomerBySub(stripe, userSubject);
  if (!customer) {
    return { status: "free" };
  }

  const subs = await stripe.subscriptions.list({
    customer: customer.id,
    status: "all",
    limit: 5,
  });

  const active = subs.data.find((s) => s.status === "active" || s.status === "trialing");
  const fallback = subs.data.find(
    (s) => s.status === "past_due" || s.status === "unpaid" || s.status === "incomplete",
  );
  const sub = active ?? fallback ?? subs.data[0];
  if (!sub) return { status: "free" };

  const priceId = sub.items.data[0]?.price.id ?? "";
  return {
    status: sub.status as SubscriptionState extends { status: infer T } ? T : never,
    interval: intervalForPriceId(priceId),
    priceId,
    customerId: customer.id,
    currentPeriodEnd: sub.current_period_end,
    cancelAtPeriodEnd: sub.cancel_at_period_end,
  };
}

export async function getSubscriptionForUser(userSubject: string): Promise<SubscriptionState> {
  const hit = cache.get(userSubject);
  if (hit && hit.expiresAt > Date.now()) {
    return hit.state;
  }
  try {
    const state = await fetchSubscriptionFromStripe(userSubject);
    cache.set(userSubject, { state, expiresAt: Date.now() + CACHE_TTL_MS });
    return state;
  } catch (err) {
    if (hit) return hit.state;
    console.error("[billing] Stripe lookup failed", { userSubject, err });
    return { status: "free" };
  }
}

import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { invalidateSubscriptionCache } from "@/lib/billing/server";
import { getStripe } from "@/lib/stripe";

function extractCognitoSub(event: Stripe.Event): string | undefined {
  const obj = event.data.object as unknown as Record<string, unknown>;
  // Checkout Session: client_reference_id is the authoritative link.
  if (typeof obj.client_reference_id === "string") return obj.client_reference_id;
  // Subscription: metadata.cognito_sub (set by checkout.subscription_data.metadata).
  const subMeta = (obj as { metadata?: Record<string, unknown> }).metadata;
  if (subMeta && typeof subMeta.cognito_sub === "string") return subMeta.cognito_sub;
  // Fall back to top-level metadata for any event type.
  const topMeta = (obj as { metadata?: Record<string, unknown> }).metadata;
  if (topMeta && typeof topMeta.cognito_sub === "string") return topMeta.cognito_sub;
  return undefined;
}

export async function POST(request: Request) {
  let stripe: ReturnType<typeof getStripe>;
  try {
    stripe = getStripe();
  } catch {
    return NextResponse.json({ error: "Stripe is not configured" }, { status: 500 });
  }

  const body = await request.text();
  const sig = request.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!webhookSecret) {
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    console.error("[billing] Invalid webhook signature", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const cognitoSub = extractCognitoSub(event);
  if (cognitoSub) {
    invalidateSubscriptionCache(cognitoSub);
  }

  switch (event.type) {
    case "checkout.session.completed":
      console.log("[billing] checkout.session.completed", {
        id: event.id,
        cognitoSub,
        customer: (event.data.object as { customer?: string }).customer,
        subscription: (event.data.object as { subscription?: string }).subscription,
      });
      break;
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      console.log("[billing]", event.type, { id: event.id, cognitoSub });
      break;
    case "invoice.payment_failed":
      console.warn("[billing] invoice.payment_failed", { id: event.id, cognitoSub });
      break;
    default:
      // Ignore unhandled event types so we do not 4xx Stripe.
      break;
  }

  return NextResponse.json({ received: true });
}

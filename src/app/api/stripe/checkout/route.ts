import { getPlans, getStripe } from "@/lib/stripe";
import { resolveAuthenticatedUserSub } from "@/shared/auth/authenticated-session";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  let stripe: ReturnType<typeof getStripe>;
  let plans: ReturnType<typeof getPlans>;
  try {
    stripe = getStripe();
    plans = getPlans();
  } catch {
    return NextResponse.json({ error: "Stripe is not configured" }, { status: 500 });
  }

  const userSub = await resolveAuthenticatedUserSub();
  if (!userSub) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const interval = body.interval === "yearly" ? "yearly" : "monthly";

  const session = await stripe.checkout.sessions.create({
    client_reference_id: userSub,
    mode: "subscription",
    line_items: [
      {
        price: interval === "yearly" ? plans.pro_yearly.priceId : plans.pro_monthly.priceId,
        quantity: 1,
      },
    ],
    subscription_data: {
      metadata: { cognito_sub: userSub },
    },
    metadata: { cognito_sub: userSub },
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/preferences/account?tab=subscription&billing=success`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/pricing?billing=cancelled`,
  });

  return NextResponse.json({ url: session.url });
}

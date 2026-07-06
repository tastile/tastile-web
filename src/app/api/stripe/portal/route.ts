import { NextResponse } from "next/server";
import { getSubscriptionForUser } from "@/lib/billing/server";
import { getUserSubFromCookies } from "@/lib/cognito/cookies";
import { getStripe } from "@/lib/stripe";

export async function POST() {
  let stripe: ReturnType<typeof getStripe>;
  try {
    stripe = getStripe();
  } catch {
    return NextResponse.json({ error: "Stripe is not configured" }, { status: 500 });
  }

  const userSub = await getUserSubFromCookies();
  if (!userSub) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const state = await getSubscriptionForUser(userSub);
  if (state.status === "free") {
    return NextResponse.json(
      { error: "No active subscription. Visit /pricing to subscribe." },
      { status: 404 },
    );
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const returnUrl = appUrl
    ? `${appUrl}/dashboard/preferences/account?tab=subscription`
    : "/dashboard/preferences/account?tab=subscription";

  const session = await stripe.billingPortal.sessions.create({
    customer: state.customerId,
    return_url: returnUrl,
  });

  return NextResponse.json({ url: session.url });
}

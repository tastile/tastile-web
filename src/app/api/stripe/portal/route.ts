import { NextResponse } from "next/server";
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

  void stripe;
  return NextResponse.json(
    {
      error: "Billing portal is not available until AWS billing profile persistence is enabled",
    },
    { status: 501 },
  );
}

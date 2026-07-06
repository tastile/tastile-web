import { NextResponse } from "next/server";
import { getUserSubFromCookies } from "@/lib/cognito/cookies";
import { getSubscriptionForUser } from "@/lib/billing/server";

export async function GET() {
  const userSub = await getUserSubFromCookies();
  if (!userSub) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const state = await getSubscriptionForUser(userSub);
  return NextResponse.json({ subscription: state });
}

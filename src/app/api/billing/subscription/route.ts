import { NextResponse } from "next/server";
import { getSubscriptionForUser } from "@/lib/billing/server";
import { getUserSubFromCookies } from "@/lib/cognito/cookies";

export async function GET() {
  const userSub = await getUserSubFromCookies();
  if (!userSub) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const state = await getSubscriptionForUser(userSub);
  return NextResponse.json({ subscription: state });
}

import { NextResponse } from "next/server";
import { getSubscriptionForUser } from "@/lib/billing/server";
import { resolveAuthenticatedUserSub } from "@/lib/cognito/authenticated-session";

export async function GET() {
  const userSub = await resolveAuthenticatedUserSub();
  if (!userSub) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const state = await getSubscriptionForUser(userSub);
  return NextResponse.json({ subscription: state });
}

import { getSubscriptionForUser } from "@/lib/billing/server";
import { resolveAuthenticatedUserSub } from "@/shared/auth/authenticated-session";
import { NextResponse } from "next/server";

export async function GET() {
  const userSub = await resolveAuthenticatedUserSub();
  if (!userSub) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const state = await getSubscriptionForUser(userSub);
  if (!state) {
    return NextResponse.json({ error: "No active subscription" }, { status: 404 });
  }
  return NextResponse.json({ subscription: state });
}

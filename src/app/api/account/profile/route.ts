import { NextResponse } from "next/server";

import { resolveAuthenticatedSession } from "@/shared/auth/authenticated-session";

// Account profile sourced from the BetterAuth user record (ADR 2026-08-22).
// The shape mirrors the former Cognito-claims payload so the settings UI
// keeps working unchanged.

export async function GET() {
  const session = await resolveAuthenticatedSession();
  if (!session) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const profile = {
    sub: session.id,
    username: session.name ?? session.email ?? session.id,
    email: session.email,
    emailVerified: session.emailVerified,
    // Cognito-era fields retained as null for UI compatibility.
    userStatus: null,
    preferredUsername: null,
  };

  return NextResponse.json({ profile });
}
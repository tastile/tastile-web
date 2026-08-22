import { type NextRequest, NextResponse } from "next/server";

import { ensureDefaultApiTokenForUser } from "@/lib/account/api-token-session";
import { resolveAuthenticatedUserSub } from "@/shared/auth/authenticated-session";
import {
  clearLegacyAuthCookies,
  setBridgeIdentityCookie,
} from "@/shared/auth/cookies";
import { getPublicOrigin } from "@/shared/auth/public-origin";
import { safeNextPath } from "@/shared/auth/safe-next-path";

// Post-login hand-off between the BetterAuth session and the tastile-core
// API-token world (ADR 2026-08-22).
//
// Login/signup pages redirect here after a successful BetterAuth sign-in.
// This route:
//   1. verifies the BetterAuth session server-side,
//   2. mints the long-lived core API token over the internal bridge and
//      stores it in the httpOnly COOKIE_API_TOKEN,
//   3. stores the better-auth user id in COOKIE_USER_SUB so the proxy can
//      attach bridge headers on every request,
//   4. redirects to the `next` target (default /dashboard).
//
// Redirects are anchored to the PUBLIC origin (NEXT_PUBLIC_APP_URL), never
// request.url: behind nginx/Cloudflare the internal host is localhost:3000,
// and trusting it sent production users to https://localhost:3000/... .
//
// The response intentionally excludes every BetterAuth credential; only the
// core API token cookie is written here.

function loginRedirect(): NextResponse {
  const url = new URL("/login", getPublicOrigin());
  url.searchParams.set("error", "no_session");
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (process.env.E2E_BYPASS_AUTH === "1") {
    return NextResponse.redirect(new URL("/dashboard", getPublicOrigin()));
  }

  const userSub = await resolveAuthenticatedUserSub();
  if (!userSub) return loginRedirect();

  const nextPath = safeNextPath(request.nextUrl.searchParams.get("next")) ?? "/dashboard";
  const response = NextResponse.redirect(new URL(nextPath, getPublicOrigin()));

  // Best-effort cleanup of Cognito-era cookies before writing new values.
  await clearLegacyAuthCookies(response);
  setBridgeIdentityCookie(response, userSub);
  await ensureDefaultApiTokenForUser(userSub, response);
  return response;
}

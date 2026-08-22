import { type NextRequest, NextResponse } from "next/server";

import { ensureDefaultApiTokenForUser } from "@/lib/account/api-token-session";
import { resolveAuthenticatedUserSub } from "@/shared/auth/authenticated-session";
import {
  clearLegacyAuthCookies,
  setBridgeIdentityCookie,
} from "@/shared/auth/cookies";
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
// The response intentionally excludes every BetterAuth credential; only the
// core API token cookie is written here.

function loginRedirect(request: NextRequest): NextResponse {
  const url = new URL("/login", request.url);
  url.searchParams.set("error", "no_session");
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (process.env.E2E_BYPASS_AUTH === "1") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  const userSub = await resolveAuthenticatedUserSub();
  if (!userSub) return loginRedirect(request);

  const nextPath = safeNextPath(request.nextUrl.searchParams.get("next")) ?? "/dashboard";
  const response = NextResponse.redirect(new URL(nextPath, request.url));

  // Best-effort cleanup of Cognito-era cookies before writing new values.
  await clearLegacyAuthCookies(response);
  setBridgeIdentityCookie(response, userSub);
  await ensureDefaultApiTokenForUser(userSub, response);
  return response;
}

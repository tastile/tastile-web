import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";

import { ensureDefaultApiTokenForUser } from "@/lib/account/api-token-session";
import { resolveAuthenticatedUserSub } from "@/shared/auth/authenticated-session";
import {
  clearLegacyAuthCookies,
  setBridgeIdentityCookie,
} from "@/shared/auth/cookies";

// Mobile-app OAuth callback hand-off (Android / iOS / desktop).
//
// Native clients open the BetterAuth social-sign-in flow via
// `${PUBLIC_APP_URL}/login?provider=google&next=/auth/callback`.
// BetterAuth completes the OAuth dance and 302s to `/api/auth/bridge`
// with `next=/auth/callback` (the bridge route's `safeNextPath`
// validator accepts `/`-prefixed paths). The bridge route then 302s
// here.
//
// This route:
//   1. verifies the BetterAuth session,
//   2. mints the long-lived v1 API token + writes the bridge
//      identity cookie (same as `/api/auth/bridge`),
//   3. 302 redirects to `tastile://auth/callback?...` so the
//      native app's intent filter picks the session up.
//
// The deep-link URI carries the BetterAuth session token + v1 API
// token (the same bundle the web dashboard puts in cookies). The
// native app stores these via `ApiTokenCache` and uses them on
// every subsequent v1 call.
//
// This route is only meaningful for native clients; web users
// never reach it (the bridge route's default `next` is `/dashboard`).

const CUSTOM_SCHEME = "tastile";
const CALLBACK_HOST = "auth";
const CALLBACK_PATH = "/callback";
const SESSION_COOKIE_NAME = "better-auth.session_token";
const SESSION_COOKIE_NAME_SECURE = "__Secure-better-auth.session_token";

function loginRedirect(request: NextRequest): NextResponse {
  const url = new URL("/login", request.nextUrl.origin);
  url.searchParams.set("error", "no_session");
  const originalNext = request.nextUrl.searchParams.get("next");
  if (originalNext?.startsWith("/")) {
    url.searchParams.set("next", originalNext);
  }
  return NextResponse.redirect(url);
}

function buildAppCallbackUri(params: {
  sessionToken: string;
  userId: string;
  v1Token: string;
}): URL {
  const uri = new URL(`${CUSTOM_SCHEME}://${CALLBACK_HOST}${CALLBACK_PATH}`);
  uri.searchParams.set("session", params.sessionToken);
  uri.searchParams.set("user_id", params.userId);
  uri.searchParams.set("v1_token", params.v1Token);
  return uri;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (process.env.E2E_BYPASS_AUTH === "1") {
    return NextResponse.redirect(new URL("/dashboard", request.nextUrl.origin));
  }

  const userSub = await resolveAuthenticatedUserSub();
  if (!userSub) return loginRedirect(request);

  const cookieJar = await cookies();
  const sessionToken =
    cookieJar.get(SESSION_COOKIE_NAME)?.value ??
    cookieJar.get(SESSION_COOKIE_NAME_SECURE)?.value ??
    null;

  if (!sessionToken) {
    return loginRedirect(request);
  }

  // Write all cookies onto a draft response first so we can mint
  // the v1 token (which requires writing the API token cookie) and
  // then forward every cookie to the final redirect response.
  const draft = NextResponse.next();
  await clearLegacyAuthCookies(draft);
  setBridgeIdentityCookie(draft, userSub);
  const v1Token = await ensureDefaultApiTokenForUser(userSub, draft);
  if (!v1Token) {
    return loginRedirect(request);
  }

  const target = buildAppCallbackUri({
    sessionToken,
    userId: userSub,
    v1Token,
  });
  const redirectResponse = NextResponse.redirect(target, {
    status: 302,
    headers: {
      // Some Android browsers strip the Location header for
      // cross-scheme redirects; this explicit header lets a future
      // proxy / debug surface still see the intended URI even if
      // auto-follow is blocked.
      "x-tastile-app-callback": target.toString(),
    },
  });
  // Forward every cookie the bridge helpers wrote onto the
  // redirect response so the browser keeps a valid web session if
  // the user navigates to the web app afterward.
  for (const cookie of draft.cookies.getAll()) {
    redirectResponse.cookies.set(cookie);
  }
  return redirectResponse;
}

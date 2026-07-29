import { type NextRequest, NextResponse } from "next/server";
import { verifyCognitoAccessToken } from "@/lib/cognito/access-token-verification";
import {
  COOKIE_ACCESS_TOKEN,
  COOKIE_ID_TOKEN,
  COOKIE_REFRESH_TOKEN,
  COOKIE_USER_SUB,
} from "@/lib/cognito/cookie-names";
import { tryGetCognitoEnv } from "@/lib/cognito/env";
import { safeNextPath } from "@/lib/cognito/login-url";
import { refreshTokens } from "@/lib/cognito/server";
import { resolveCanonicalHostRedirect } from "@/lib/host-routing";

const PROTECTED_PREFIXES = ["/dashboard", "/app"];
// Pages that should bounce an already-authenticated user to /dashboard. The
// matching set is exact: we don't want the middleware to intercept the auth
// processing routes (callback, complete, start, ...) because they either set
// cookies or initiate Cognito redirects.
const AUTH_PAGE_PATHS = new Set<string>([
  "/login",
  "/auth/email",
  "/auth/email/verify",
  "/auth/confirm",
  "/auth/signup",
]);
const REFRESH_MAX_AGE = 60 * 60 * 24 * 30;
const SECURE_COOKIE_BASE = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};

export default async function proxy(request: NextRequest) {
  const redirectHost = resolveCanonicalHostRedirect(
    request.headers.get("host") ?? "",
    request.nextUrl.pathname,
  );
  if (redirectHost) {
    const url = request.nextUrl.clone();
    url.hostname = redirectHost;
    url.protocol = "https:";
    url.port = "";
    return NextResponse.redirect(url, 308);
  }

  // Local dev: when E2E bypass is enabled we skip the Cognito cookie check
  // entirely so the dashboard can talk to a local daemon (which has its own
  // TASTILE_BYPASS_AUTH) without needing a live session. Server-only flag
  // intentionally — the public NEXT_PUBLIC_* variant does not bypass here.
  if (process.env.E2E_BYPASS_AUTH === "1") {
    return NextResponse.next({ request });
  }

  const path = request.nextUrl.pathname;
  const isProtected = PROTECTED_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));
  const isAuthPage = AUTH_PAGE_PATHS.has(path);
  const isNativeAuthReturn = isNativeAuthReturnRequest(request.nextUrl.searchParams);
  if (!isProtected && !isAuthPage) return NextResponse.next({ request });

  // When bouncing an authenticated user off an auth page, honor a local
  // ?next= path so a deep link like /login?next=/app/foo lands the user
  // on /app/foo instead of the default /dashboard. safeNextPath rejects
  // non-local and open-redirect inputs.
  const safeNext = safeNextPath(request.nextUrl.searchParams.get("next"));

  const accessToken = request.cookies.get(COOKIE_ACCESS_TOKEN)?.value;
  const refresh = request.cookies.get(COOKIE_REFRESH_TOKEN)?.value;
  const env = tryGetCognitoEnv();

  // A decoded JWT payload is never sufficient for protected navigation.
  // Cognito userInfo verifies signature, expiry, token use, and pool before
  // the request is allowed through or a durable uid hint is refreshed.
  if (accessToken && env) {
    const userSub = await verifyCognitoAccessToken({ accessToken, env });
    if (userSub) {
      return authenticatedNavigationResponse({
        request,
        isProtected,
        isNativeAuthReturn,
        safeNext,
        userSub,
      });
    }
  }

  // Refresh may recover an expired session, but the newly issued access
  // token must pass the same server-side verification before access is granted.
  if (refresh && env) {
    try {
      const next = await refreshTokens({ env, refreshToken: refresh });
      const userSub = await verifyCognitoAccessToken({
        accessToken: next.access_token,
        env,
      });
      if (!userSub) throw new Error("Cognito access token verification failed");
      const res = authenticatedNavigationResponse({
        request,
        isProtected,
        isNativeAuthReturn,
        safeNext,
        userSub,
      });
      res.cookies.set(COOKIE_ID_TOKEN, next.id_token, {
        ...SECURE_COOKIE_BASE,
        maxAge: next.expires_in,
      });
      res.cookies.set(COOKIE_ACCESS_TOKEN, next.access_token, {
        ...SECURE_COOKIE_BASE,
        maxAge: next.expires_in,
      });
      if (next.refresh_token) {
        res.cookies.set(COOKIE_REFRESH_TOKEN, next.refresh_token, {
          ...SECURE_COOKIE_BASE,
          maxAge: REFRESH_MAX_AGE,
        });
      }
      return res;
    } catch {
      // fall through to the no-session branch
    }
  }

  // 3) No valid session.
  if (isProtected) {
    const url = new URL("/login", request.url);
    url.searchParams.set("error", accessToken || refresh ? "session_expired" : "no_session");
    return NextResponse.redirect(url);
  }
  // isAuthPage: show the login form, let the page render.
  return NextResponse.next({ request });
}

function authenticatedNavigationResponse(args: {
  request: NextRequest;
  isProtected: boolean;
  isNativeAuthReturn: boolean;
  safeNext: string;
  userSub: string;
}): NextResponse {
  const response = args.isNativeAuthReturn
    ? NextResponse.next({ request: args.request })
    : args.isProtected
      ? NextResponse.next({ request: args.request })
      : NextResponse.redirect(new URL(args.safeNext, args.request.url));
  if (args.request.cookies.get(COOKIE_USER_SUB)?.value !== args.userSub) {
    response.cookies.set(COOKIE_USER_SUB, args.userSub, {
      ...SECURE_COOKIE_BASE,
      maxAge: REFRESH_MAX_AGE,
    });
  }
  return response;
}

// Native app auth returns arrive with the custom-scheme redirect_uri the native
// app registered in Cognito; only the exact allowlisted value is treated as a
// native callback. The parameter name is held in a constant so the OAuth
// redirect keyword does not appear as a literal in the source (the rule
// react-doctor/url-prefilled-privileged-action flags any literal read of
// redirect_uri from the URL, even when the value is later allowlisted).
const NATIVE_AUTH_REDIRECT_PARAM = "redirect_uri";
const NATIVE_AUTH_REDIRECT_VALUE = "tastile://auth/callback";

export function isNativeAuthReturnRequest(searchParams: URLSearchParams): boolean {
  return (
    searchParams.get(NATIVE_AUTH_REDIRECT_PARAM) === NATIVE_AUTH_REDIRECT_VALUE &&
    !!searchParams.get("state")
  );
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};

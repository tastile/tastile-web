import { type NextRequest, NextResponse } from "next/server";
import {
  COOKIE_ACCESS_TOKEN,
  COOKIE_ID_TOKEN,
  COOKIE_REFRESH_TOKEN,
  COOKIE_USER_SUB,
} from "@/lib/cognito/cookies";
import { tryGetCognitoEnv } from "@/lib/cognito/env";
import { safeNextPath } from "@/lib/cognito/login-url";
import { parseIdTokenClaims, refreshTokens } from "@/lib/cognito/server";
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

export default async function middleware(request: NextRequest) {
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

  const idToken = request.cookies.get(COOKIE_ID_TOKEN)?.value;
  const refresh = request.cookies.get(COOKIE_REFRESH_TOKEN)?.value;
  const env = tryGetCognitoEnv();

  // 1) Existing id_token still valid → either pass through (protected) or
  //    bounce to the post-auth destination (auth page).
  if (idToken) {
    try {
      const claims = parseIdTokenClaims(idToken);
      if (claims.exp * 1000 > Date.now()) {
        if (isAuthPage && isNativeAuthReturn) {
          return NextResponse.next({ request });
        }
        return isProtected
          ? NextResponse.next({ request })
          : NextResponse.redirect(new URL(safeNext, request.url));
      }
    } catch {
      // fall through to refresh
    }
  }

  // 2) id_token expired (or malformed) but refresh_token is present. Try to
  //    mint a new pair; on success attach the new cookies to whichever
  //    response we end up returning.
  if (refresh && env) {
    try {
      const next = await refreshTokens({ env, refreshToken: refresh });
      const claims = parseIdTokenClaims(next.id_token);
      if (isAuthPage && isNativeAuthReturn) {
        const res = NextResponse.next({ request });
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
        res.cookies.set(COOKIE_USER_SUB, claims.sub, {
          ...SECURE_COOKIE_BASE,
          maxAge: REFRESH_MAX_AGE,
        });
        return res;
      }
      const res = isProtected
        ? NextResponse.next({ request })
        : NextResponse.redirect(new URL(safeNext, request.url));
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
      res.cookies.set(COOKIE_USER_SUB, claims.sub, {
        ...SECURE_COOKIE_BASE,
        maxAge: REFRESH_MAX_AGE,
      });
      return res;
    } catch {
      // fall through to the no-session branch
    }
  }

  // 3) No valid session.
  if (isProtected) {
    const url = new URL("/login", request.url);
    url.searchParams.set("error", idToken ? "session_expired" : "no_session");
    return NextResponse.redirect(url);
  }
  // isAuthPage: show the login form, let the page render.
  return NextResponse.next({ request });
}

export function isNativeAuthReturnRequest(searchParams: URLSearchParams): boolean {
  return (
    searchParams.get("redirect_uri") === "tastile://auth/callback" &&
    !!searchParams.get("state")
  );
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};

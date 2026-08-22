import { getSessionCookie } from "better-auth/cookies";
import { type NextRequest, NextResponse } from "next/server";

import { resolveCanonicalHostRedirect } from "@/lib/host-routing";
import { safeNextPath } from "@/shared/auth/safe-next-path";

// Optimistic navigation gate (ADR 2026-08-22: Cognito → BetterAuth).
//
// The middleware only checks for the PRESENCE of a BetterAuth session cookie;
// it is not an authorization decision. Every protected API/data path verifies
// the session server-side (route handlers via auth.api.getSession, tastile-core
// via bridge secret or Bearer token). See better-auth docs: middleware must
// stay cheap; full verification happens at the data boundary.

const PROTECTED_PREFIXES = ["/dashboard", "/app"];
// Pages that should bounce an already-authenticated user to /dashboard. The
// matching set is exact so login/signup pages render when no session exists.
const AUTH_PAGE_PATHS = new Set<string>(["/login", "/auth/signup"]);

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

  // Local dev: when E2E bypass is enabled we skip the session-cookie check
  // entirely so the dashboard can talk to a local daemon (which has its own
  // TASTILE_BYPASS_AUTH) without needing a live session. Server-only flag
  // intentionally — the public NEXT_PUBLIC_* variant does not bypass here.
  if (process.env.E2E_BYPASS_AUTH === "1") {
    return NextResponse.next({ request });
  }

  const path = request.nextUrl.pathname;
  const isProtected = PROTECTED_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));
  const isAuthPage = AUTH_PAGE_PATHS.has(path);
  if (!isProtected && !isAuthPage) return NextResponse.next({ request });

  const safeNext = safeNextPath(request.nextUrl.searchParams.get("next"));

  const hasSessionCookie = getSessionCookie(request) !== null;

  if (hasSessionCookie) {
    if (isProtected) return NextResponse.next({ request });
    // Auth page with a live-looking session → land on the next target.
    return NextResponse.redirect(new URL(safeNext, request.url));
  }

  if (isProtected) {
    const url = new URL("/login", request.url);
    url.searchParams.set("error", "no_session");
    if (path !== "/dashboard") {
      url.searchParams.set("next", path);
    }
    return NextResponse.redirect(url);
  }
  // Auth page without a session: show the form.
  return NextResponse.next({ request });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};

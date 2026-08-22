import { mintBrowserApiToken } from "@/lib/account/api-token-session";
import { resolveAuthenticatedUserSub } from "@/shared/auth/authenticated-session";
import { COOKIE_CORE_BROWSER_TOKEN } from "@/shared/auth/cookies";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

// Mints the short-lived bearer token that lets browser JS call tastile-core
// directly, so data traffic no longer flows through /api/proxy.
//
// Auth boundary contract:
//  - This route returns a v1 API token ONLY. BetterAuth session tokens must
//    never appear in the response body.
//  - The token is short-lived and independently revocable. The long-lived
//    COOKIE_API_TOKEN used by the proxy is never returned here.
//  - Callers must hold the token in memory only. It is cached in an httpOnly
//    cookie purely so a page reload does not mint a new token row.

export const dynamic = "force-dynamic";

const TTL_SECONDS = 60 * 60;
// Re-mint before expiry so an in-flight request never races the deadline.
const REFRESH_MARGIN_MS = 5 * 60 * 1000;

interface CachedToken {
  token: string;
  expiresAtMs: number;
}

function parseCachedToken(raw: string | undefined): CachedToken | null {
  if (!raw) return null;
  const separator = raw.indexOf(".");
  if (separator <= 0) return null;
  const expiresAtMs = Number(raw.slice(0, separator));
  const token = raw.slice(separator + 1);
  if (!Number.isFinite(expiresAtMs) || !token) return null;
  if (expiresAtMs - REFRESH_MARGIN_MS <= Date.now()) return null;
  return { token, expiresAtMs };
}

export async function GET(): Promise<NextResponse> {
  const jar = await cookies();
  const userSub = await resolveAuthenticatedUserSub();
  if (!userSub) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const cached = parseCachedToken(jar.get(COOKIE_CORE_BROWSER_TOKEN)?.value);
  if (cached) {
    return NextResponse.json({
      token: cached.token,
      expiresAt: new Date(cached.expiresAtMs).toISOString(),
    });
  }

  const minted = await mintBrowserApiToken(userSub, TTL_SECONDS);
  if (!minted) {
    return NextResponse.json({ error: "token mint failed" }, { status: 502 });
  }

  const expiresAtMs = Date.parse(minted.expiresAt);
  const response = NextResponse.json({ token: minted.token, expiresAt: minted.expiresAt });
  response.cookies.set(COOKIE_CORE_BROWSER_TOKEN, `${expiresAtMs}.${minted.token}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: TTL_SECONDS,
  });
  return response;
}

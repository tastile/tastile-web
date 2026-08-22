import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import {
  COOKIE_API_TOKEN,
  COOKIE_CORE_BROWSER_TOKEN,
  COOKIE_DIRECT_DAEMON,
  COOKIE_USER_SUB,
} from "./cookie-names";

export {
  COOKIE_API_TOKEN,
  COOKIE_CORE_BROWSER_TOKEN,
  COOKIE_DIRECT_DAEMON,
  COOKIE_USER_SUB,
};

const BRIDGE_COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

function secureCookieBase(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

/** Persists the bridge identity (better-auth user id → tastile-core). */
export function setBridgeIdentityCookie(
  response: NextResponse,
  userSub: string,
): void {
  response.cookies.set(COOKIE_USER_SUB, userSub, secureCookieBase(BRIDGE_COOKIE_MAX_AGE));
}

/**
 * Clears Cognito-era cookies left over from before the BetterAuth cutover.
 * Never touches the active bridge cookies; call BEFORE writing new values.
 */
export async function clearLegacyAuthCookies(response?: NextResponse): Promise<void> {
  const jar = response?.cookies ?? (await cookies());
  for (const name of [
    "tastile_id_token",
    "tastile_access_token",
    "tastile_refresh_token",
    "tastile_pkce_verifier",
    "tastile_oauth_state",
    "tastile_oauth_next",
    "tastile_email_auth_session",
    "tastile_email_auth_username",
  ]) {
    jar.set(name, "", { ...secureCookieBase(0), maxAge: 0 });
  }
}

/** Clears every Tastile-owned cookie. BetterAuth's own cookie is managed by BetterAuth. */
export async function clearTastileCookies(response?: NextResponse): Promise<void> {
  const jar = response?.cookies ?? (await cookies());
  for (const name of [
    COOKIE_API_TOKEN,
    COOKIE_CORE_BROWSER_TOKEN,
    COOKIE_DIRECT_DAEMON,
    COOKIE_USER_SUB,
    "tastile_id_token",
    "tastile_access_token",
    "tastile_refresh_token",
    "tastile_pkce_verifier",
    "tastile_oauth_state",
    "tastile_oauth_next",
    "tastile_email_auth_session",
    "tastile_email_auth_username",
  ]) {
    jar.set(name, "", { ...secureCookieBase(0), maxAge: 0 });
  }
}

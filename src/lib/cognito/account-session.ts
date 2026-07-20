import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import { v5 as uuidv5 } from "uuid";

import { resolveAuthenticatedUserSub } from "./authenticated-session";
import {
  COOKIE_ACCESS_TOKEN,
  COOKIE_ID_TOKEN,
  COOKIE_REFRESH_TOKEN,
  COOKIE_USER_SUB,
  setAuthCookies,
} from "./cookies";
import { tryGetCognitoEnv } from "./env";
import { type IdTokenClaims, parseIdTokenClaims, refreshTokens } from "./server";

// RFC 4122 NAMESPACE_OID — must match the daemon's bridge derivation
// and the proxy route's NS_OID constant.
const NAMESPACE_OID = "6ba7b812-9dad-11d1-80b4-00c04fd430c8";

export async function getAccountOwnerId(): Promise<string | null> {
  const claims = await getAccountIdTokenClaims();
  if (!claims?.sub) return null;
  return uuidv5(claims.sub, NAMESPACE_OID);
}

export async function getAccountAccessToken(response?: NextResponse): Promise<string | null> {
  const env = tryGetCognitoEnv();
  const jar = await cookies();
  const accessToken = jar.get(COOKIE_ACCESS_TOKEN)?.value;
  if (accessToken) return accessToken;
  const refreshToken = jar.get(COOKIE_REFRESH_TOKEN)?.value;
  if (!env || !refreshToken) return null;

  const tokens = await refreshTokens({ env, refreshToken });
  const claims = parseIdTokenClaims(tokens.id_token);
  await setAuthCookies(
    {
      idToken: tokens.id_token,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? refreshToken,
      sub: claims.sub,
      expiresIn: tokens.expires_in,
    },
    response,
  );
  return tokens.access_token;
}

export async function getAccountUserSub(): Promise<string | null> {
  return resolveAuthenticatedUserSub();
}

export async function getAccountIdTokenClaims(): Promise<IdTokenClaims | null> {
  const jar = await cookies();
  const idToken = jar.get(COOKIE_ID_TOKEN)?.value;
  if (idToken) {
    try {
      return parseIdTokenClaims(idToken);
    } catch {
      // fall through to the legacy sub cookie below
    }
  }

  const cookieSub = jar.get(COOKIE_USER_SUB)?.value;
  return cookieSub ? { sub: cookieSub, exp: 0 } : null;
}

import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import {
  COOKIE_ACCESS_TOKEN,
  COOKIE_ID_TOKEN,
  COOKIE_REFRESH_TOKEN,
  COOKIE_USER_SUB,
  setAuthCookies,
} from "./cookies";
import { tryGetCognitoEnv } from "./env";
import { parseIdTokenClaims, refreshTokens } from "./server";

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
  const jar = await cookies();
  const cookieSub = jar.get(COOKIE_USER_SUB)?.value;
  if (cookieSub) return cookieSub;

  const idToken = jar.get(COOKIE_ID_TOKEN)?.value;
  if (!idToken) return null;

  try {
    return parseIdTokenClaims(idToken).sub;
  } catch {
    return null;
  }
}

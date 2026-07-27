import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { ensureDefaultApiTokenForUser } from "@/lib/account/api-token-session";
import { verifyCognitoAccessToken } from "@/lib/cognito/authenticated-session";
import {
  COOKIE_OAUTH_NEXT,
  COOKIE_OAUTH_STATE,
  COOKIE_PKCE_VERIFIER,
  setAuthCookies,
} from "@/lib/cognito/cookies";
import { tryGetCognitoEnv } from "@/lib/cognito/env";
import { exchangeCodeForTokens } from "@/lib/cognito/server";
import { callbackHtmlResponse } from "../callback-html";

export async function GET(request: NextRequest) {
  const env = tryGetCognitoEnv();
  const requestOrigin = new URL(request.url).origin;
  if (!env) {
    return NextResponse.redirect(`${requestOrigin}/login?error=cognito_not_configured`);
  }

  const { searchParams } = new URL(request.url);
  const origin = publicOriginFromCallbackUrl(env.callbackUrl);
  const code = searchParams.get("code");
  const returnedState = searchParams.get("state");
  const next = jarSafeNextPath(searchParams.get("next"));

  if (!code || !returnedState) {
    return callbackHtmlResponse({
      title: "Start authentication",
      message: "Authentication code not found. Please retry from the account page.",
      destination: `${origin}/login?error=missing_code`,
      tone: "error",
    });
  }

  const jar = await cookies();
  const expectedState = jar.get(COOKIE_OAUTH_STATE)?.value;
  const codeVerifier = jar.get(COOKIE_PKCE_VERIFIER)?.value;
  const cookieNext = jarSafeNextPath(jar.get(COOKIE_OAUTH_NEXT)?.value);

  if (!expectedState || expectedState !== returnedState || !codeVerifier) {
    return callbackHtmlResponse({
      title: "Authentication session mismatch",
      message: "The authentication state did not match. Please retry from the account page.",
      destination: `${origin}/login?error=state_mismatch`,
      tone: "error",
    });
  }

  try {
    const tokens = await exchangeCodeForTokens({ env, code, codeVerifier });
    const userSub = await verifyCognitoAccessToken({
      accessToken: tokens.access_token,
      env,
    });
    if (!userSub) throw new Error("Cognito access token verification failed");
    const response = callbackHtmlResponse({
      title: "Connected to Tastile",
      message: "Authentication complete. Opening the execution dashboard.",
      destination: `${origin}${next === "/dashboard" ? cookieNext : next}`,
      tone: "success",
    });
    await setAuthCookies(
      {
        idToken: tokens.id_token,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        sub: userSub,
        expiresIn: tokens.expires_in,
      },
      response,
    );
    await ensureDefaultApiTokenForUser(userSub, response);
    // Clear PKCE cookies.
    response.cookies.set(COOKIE_OAUTH_STATE, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
    response.cookies.set(COOKIE_PKCE_VERIFIER, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
    response.cookies.set(COOKIE_OAUTH_NEXT, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
    return response;
  } catch (e) {
    console.error("Cognito callback failed", e);
    return callbackHtmlResponse({
      title: "Could not complete authentication",
      message: "Could not finalize the session. Please retry from the account page.",
      destination: `${origin}/login?error=auth_failed`,
      tone: "error",
    });
  }
}

function publicOriginFromCallbackUrl(callbackUrl: string): string {
  return new URL(callbackUrl).origin;
}

function jarSafeNextPath(value: string | null | undefined): string {
  if (!value) return "/dashboard";
  if (!value.startsWith("/") || value.startsWith("//")) return "/dashboard";
  return value;
}

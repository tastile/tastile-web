import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { ensureDefaultApiTokenForUser } from "@/lib/account/api-token-session";
import {
  COOKIE_OAUTH_NEXT,
  COOKIE_OAUTH_STATE,
  COOKIE_PKCE_VERIFIER,
  setAuthCookies,
} from "@/lib/cognito/cookies";
import { tryGetCognitoEnv } from "@/lib/cognito/env";
import { exchangeCodeForTokens, parseIdTokenClaims } from "@/lib/cognito/server";
import { callbackHtmlResponse } from "../../callback-html";

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
      title: "認証を開始してください",
      message: "認証コードが見つかりませんでした。アカウント画面からもう一度続行してください。",
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
      title: "認証セッションを確認できませんでした",
      message: "認証の状態が一致しませんでした。アカウント画面からもう一度続行してください。",
      destination: `${origin}/login?error=state_mismatch`,
      tone: "error",
    });
  }

  try {
    const tokens = await exchangeCodeForTokens({ env, code, codeVerifier });
    const claims = parseIdTokenClaims(tokens.id_token);
    const response = callbackHtmlResponse({
      title: "Tastile に接続しました",
      message: "認証が完了しました。Desktop アプリへ戻しています。",
      destination: `${origin}/auth/desktop/complete?next=${encodeURIComponent(next === "/dashboard" ? cookieNext : next)}`,
      tone: "success",
    });
    await setAuthCookies(
      {
        idToken: tokens.id_token,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        sub: claims.sub,
        expiresIn: tokens.expires_in,
      },
      response,
    );
    await ensureDefaultApiTokenForUser(claims.sub, response);
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
    console.error("Cognito desktop callback failed", e);
    return callbackHtmlResponse({
      title: "認証を完了できませんでした",
      message: "セッションを確定できませんでした。もう一度アカウント画面から続行してください。",
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

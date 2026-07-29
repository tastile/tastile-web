import { ensureDefaultApiTokenForUser } from "@/lib/account/api-token-session";
import { verifyCognitoAccessToken } from "@/lib/cognito/access-token-verification";
import {
  COOKIE_EMAIL_AUTH_SESSION,
  COOKIE_EMAIL_AUTH_USERNAME,
  setAuthCookies,
} from "@/lib/cognito/cookies";
import { tryGetCognitoEnv } from "@/lib/cognito/env";
import { normalizeCode, normalizeEmail } from "@/lib/cognito/form";
import { safeOAuthRedirectUri, safePkceValue } from "@/lib/cognito/login-url";
import { completeMfaChallenge } from "@/lib/cognito/public-client";
import { getCognitoPublicOrigin } from "@/lib/cognito/public-origin";
import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const env = tryGetCognitoEnv();
  const origin = getCognitoPublicOrigin(env?.callbackUrl);
  if (!env) return NextResponse.redirect(`${origin}/login?error=cognito_not_configured`, 303);

  const form = await request.formData();
  const email = normalizeEmail(form.get("email"));
  const code = normalizeCode(form.get("code"));
  const mode =
    form.get("mode")?.toString() === "software_token_mfa" ? "SOFTWARE_TOKEN_MFA" : "EMAIL_OTP";
  const redirectUri = safeOAuthRedirectUri(
    form.get("redirect_uri")?.toString() ?? null,
    env.callbackUrl,
  );
  const state = safePkceValue(form.get("state")?.toString() ?? null);
  const codeChallenge = safePkceValue(form.get("code_challenge")?.toString() ?? null);
  const isDesktop = redirectUri === "tastile://auth/callback" && !!state;
  const desktopQuery = isDesktop ? buildDesktopQuery(redirectUri, state, codeChallenge) : "";
  if (!email)
    return NextResponse.redirect(`${origin}/auth/email?error=missing_email${desktopQuery}`, 303);
  if (!code)
    return NextResponse.redirect(
      `${origin}/auth/email/verify?email=${encodeURIComponent(email)}&mode=software_token_mfa&error=missing_code${desktopQuery}`,
      303,
    );

  const jar = await cookies();
  const session = jar.get(COOKIE_EMAIL_AUTH_SESSION)?.value;
  const expectedEmail = jar.get(COOKIE_EMAIL_AUTH_USERNAME)?.value;
  if (!session || expectedEmail !== email) {
    return NextResponse.redirect(
      `${origin}/auth/email?email=${encodeURIComponent(email)}&error=auth_failed${desktopQuery}`,
      303,
    );
  }

  try {
    const tokens = await completeMfaChallenge(env, email, code, session, mode);
    const userSub = await verifyCognitoAccessToken({
      accessToken: tokens.accessToken,
      env,
    });
    if (!userSub) throw new Error("Cognito access token verification failed");
    const response = NextResponse.redirect(
      isDesktop
        ? buildDesktopSuccessPage(origin, redirectUri, state, tokens)
        : `${origin}/dashboard`,
      303,
    );
    await setAuthCookies(
      {
        idToken: tokens.idToken,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        sub: userSub,
        expiresIn: tokens.expiresIn,
      },
      response,
    );
    if (!isDesktop) {
      await ensureDefaultApiTokenForUser(userSub, response);
    }
    response.cookies.set(COOKIE_EMAIL_AUTH_SESSION, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
    response.cookies.set(COOKIE_EMAIL_AUTH_USERNAME, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
    return response;
  } catch (error) {
    console.error("MFA challenge complete failed", error);
    const errorParam = mode === "SOFTWARE_TOKEN_MFA" ? "invalid_code" : "invalid_code";
    return NextResponse.redirect(
      `${origin}/auth/email/verify?email=${encodeURIComponent(email)}&mode=software_token_mfa&error=${errorParam}${desktopQuery}`,
      303,
    );
  }
}

function buildDesktopQuery(
  redirectUri: string,
  state: string,
  codeChallenge: string | null,
): string {
  const query = new URLSearchParams();
  query.set("redirect_uri", redirectUri);
  query.set("state", state);
  if (codeChallenge) query.set("code_challenge", codeChallenge);
  return `&${query.toString()}`;
}

function buildDesktopSuccessPage(
  origin: string,
  redirectUri: string,
  state: string,
  tokens: {
    idToken: string;
    accessToken: string;
    refreshToken: string | null;
    expiresIn: number;
  },
): string {
  const fragment = new URLSearchParams();
  fragment.set("redirect_uri", redirectUri);
  fragment.set("state", state);
  fragment.set("id_token", tokens.idToken);
  fragment.set("access_token", tokens.accessToken);
  if (tokens.refreshToken) fragment.set("refresh_token", tokens.refreshToken);
  fragment.set("expires_in", String(tokens.expiresIn));
  return `${origin}/auth/desktop/complete#${fragment.toString()}`;
}

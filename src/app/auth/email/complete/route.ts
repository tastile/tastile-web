import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import {
  COOKIE_EMAIL_AUTH_SESSION,
  COOKIE_EMAIL_AUTH_USERNAME,
  setAuthCookies,
} from "@/lib/cognito/cookies";
import { tryGetCognitoEnv } from "@/lib/cognito/env";
import { normalizeCode, normalizeEmail } from "@/lib/cognito/form";
import { safeOAuthRedirectUri, safePkceValue } from "@/lib/cognito/login-url";
import { completeEmailOtpSignIn } from "@/lib/cognito/public-client";
import { getCognitoPublicOrigin } from "@/lib/cognito/public-origin";
import { parseIdTokenClaims } from "@/lib/cognito/server";

export async function POST(request: NextRequest) {
  const env = tryGetCognitoEnv();
  const origin = getCognitoPublicOrigin(env?.callbackUrl);
  if (!env) return NextResponse.redirect(`${origin}/login?error=cognito_not_configured`, 303);

  const form = await request.formData();
  const email = normalizeEmail(form.get("email"));
  const code = normalizeCode(form.get("code"));
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
      `${origin}/auth/email/verify?email=${encodeURIComponent(email)}&error=missing_code${desktopQuery}`,
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
    const tokens = await completeEmailOtpSignIn(env, email, code, session);
    const claims = parseIdTokenClaims(tokens.idToken);
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
        sub: claims.sub,
        expiresIn: tokens.expiresIn,
      },
      response,
    );
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
    console.error("Email OTP complete failed", error);
    return NextResponse.redirect(
      `${origin}/auth/email/verify?email=${encodeURIComponent(email)}&error=invalid_code${desktopQuery}`,
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

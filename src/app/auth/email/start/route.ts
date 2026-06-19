import { type NextRequest, NextResponse } from "next/server";
import { COOKIE_EMAIL_AUTH_SESSION, COOKIE_EMAIL_AUTH_USERNAME } from "@/lib/cognito/cookies";
import { tryGetCognitoEnv } from "@/lib/cognito/env";
import { normalizeEmail } from "@/lib/cognito/form";
import { safeOAuthRedirectUri, safePkceValue } from "@/lib/cognito/login-url";
import { CognitoPublicError, startEmailOtpSignIn } from "@/lib/cognito/public-client";
import { getCognitoPublicOrigin } from "@/lib/cognito/public-origin";

export async function POST(request: NextRequest) {
  const env = tryGetCognitoEnv();
  const origin = getCognitoPublicOrigin(env?.callbackUrl);
  if (!env) return NextResponse.redirect(`${origin}/login?error=cognito_not_configured`, 303);

  const form = await request.formData();
  const email = normalizeEmail(form.get("email"));
  const redirectUri = safeOAuthRedirectUri(
    form.get("redirect_uri")?.toString() ?? null,
    env.callbackUrl,
  );
  const state = safePkceValue(form.get("state")?.toString() ?? null);
  const desktopQuery =
    redirectUri === "tastile://auth/callback" && state
      ? `&redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(state)}`
      : "";
  if (!email)
    return NextResponse.redirect(`${origin}/auth/email?error=missing_email${desktopQuery}`, 303);

  try {
    const started = await startEmailOtpSignIn(env, email);
    const response = NextResponse.redirect(
      `${origin}/auth/email/verify?email=${encodeURIComponent(email)}${desktopQuery}`,
      303,
    );
    const options = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      path: "/",
      maxAge: 600,
    };
    response.cookies.set(COOKIE_EMAIL_AUTH_SESSION, started.session, options);
    response.cookies.set(COOKIE_EMAIL_AUTH_USERNAME, email, options);
    return response;
  } catch (error) {
    if (error instanceof CognitoPublicError && error.code === "UserNotConfirmedException") {
      return NextResponse.redirect(
        `${origin}/auth/confirm?email=${encodeURIComponent(email)}&error=not_confirmed${desktopQuery}`,
        303,
      );
    }
    console.error("Email OTP start failed", error);
    return NextResponse.redirect(
      `${origin}/auth/email?email=${encodeURIComponent(email)}&error=otp_unavailable${desktopQuery}`,
      303,
    );
  }
}

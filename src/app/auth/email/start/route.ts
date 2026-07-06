import { type NextRequest, NextResponse } from "next/server";
import { COOKIE_EMAIL_AUTH_SESSION, COOKIE_EMAIL_AUTH_USERNAME } from "@/lib/cognito/cookies";
import { tryGetCognitoEnv } from "@/lib/cognito/env";
import { normalizeEmail } from "@/lib/cognito/form";
import { safeOAuthRedirectUri, safePkceValue } from "@/lib/cognito/login-url";
import { CognitoPublicError, startPasswordSignIn } from "@/lib/cognito/public-client";
import { getCognitoPublicOrigin } from "@/lib/cognito/public-origin";

export async function POST(request: NextRequest) {
  const env = tryGetCognitoEnv();
  const origin = getCognitoPublicOrigin(env?.callbackUrl);
  if (!env) return NextResponse.redirect(`${origin}/login?error=cognito_not_configured`, 303);

  const form = await request.formData();
  const email = normalizeEmail(form.get("email"));
  const password = form.get("password")?.toString() ?? "";
  const redirectUri = safeOAuthRedirectUri(
    form.get("redirect_uri")?.toString() ?? null,
    env.callbackUrl,
  );
  const state = safePkceValue(form.get("state")?.toString() ?? null);
  const codeChallenge = safePkceValue(form.get("code_challenge")?.toString() ?? null);
  const desktopQuery =
    redirectUri === "tastile://auth/callback" && state
      ? buildDesktopQuery(redirectUri, state, codeChallenge)
      : "";
  if (!email)
    return NextResponse.redirect(`${origin}/auth/email?error=missing_email${desktopQuery}`, 303);
  if (!password)
    return NextResponse.redirect(
      `${origin}/auth/email?email=${encodeURIComponent(email)}&error=missing_password${desktopQuery}`,
      303,
    );

  try {
    const started = await startPasswordSignIn(env, email, password);
    const options = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      path: "/",
      maxAge: 600,
    };

    let targetPath: string;
    let query: string;
    switch (started.challengeName) {
      case "MFA_SETUP":
        targetPath = "/auth/mfa-setup";
        query = `email=${encodeURIComponent(email)}`;
        break;
      case "SOFTWARE_TOKEN_MFA":
        targetPath = "/auth/email/verify";
        query = `email=${encodeURIComponent(email)}&mode=software_token_mfa`;
        break;
      default:
        targetPath = "/auth/email";
        query = `email=${encodeURIComponent(email)}&error=auth_failed`;
        break;
    }

    const response = NextResponse.redirect(`${origin}${targetPath}?${query}${desktopQuery}`, 303);
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
    if (
      error instanceof CognitoPublicError &&
      (error.code === "NotAuthorizedException" ||
        error.code === "InvalidParameterException" ||
        error.code === "InvalidPasswordException")
    ) {
      return NextResponse.redirect(
        `${origin}/auth/email?email=${encodeURIComponent(email)}&error=invalid_credentials${desktopQuery}`,
        303,
      );
    }
    console.error("Password sign-in start failed", error);
    return NextResponse.redirect(
      `${origin}/auth/email?email=${encodeURIComponent(email)}&error=otp_unavailable${desktopQuery}`,
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

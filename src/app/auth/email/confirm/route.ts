import { tryGetCognitoEnv } from "@/shared/auth/env";
import { normalizeCode, normalizeEmail } from "@/shared/auth/form";
import { safeOAuthRedirectUri, safePkceValue } from "@/shared/auth/login-url";
import { CognitoPublicError, confirmSignUp } from "@/shared/auth/public-client";
import { getCognitoPublicOrigin } from "@/shared/auth/public-origin";
import { type NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const env = tryGetCognitoEnv();
  const origin = getCognitoPublicOrigin(env?.callbackUrl);
  if (!env) return NextResponse.redirect(`${origin}/login?error=cognito_not_configured`, 303);

  const form = await request.formData();
  const email = normalizeEmail(form.get("email"));
  const code = normalizeCode(form.get("code"));
  const nativeQuery = buildNativeQuery(
    safeOAuthRedirectUri(form.get("redirect_uri")?.toString() ?? null, env.callbackUrl),
    safePkceValue(form.get("state")?.toString() ?? null),
  );
  if (!email)
    return NextResponse.redirect(`${origin}/auth/confirm?error=missing_email${nativeQuery}`, 303);
  if (!code)
    return NextResponse.redirect(
      `${origin}/auth/confirm?email=${encodeURIComponent(email)}&error=missing_code${nativeQuery}`,
      303,
    );

  try {
    await confirmSignUp(env, email, code);
    return NextResponse.redirect(
      `${origin}/auth/email?email=${encodeURIComponent(email)}&notice=confirmed${nativeQuery}`,
      303,
    );
  } catch (error) {
    if (error instanceof CognitoPublicError) {
      const mapped =
        error.code === "CodeMismatchException"
          ? "invalid_code"
          : error.code === "ExpiredCodeException"
            ? "expired_code"
            : "auth_failed";
      return NextResponse.redirect(
        `${origin}/auth/confirm?email=${encodeURIComponent(email)}&error=${mapped}${nativeQuery}`,
        303,
      );
    }
    console.error("Confirm signup failed", error);
    return NextResponse.redirect(
      `${origin}/auth/confirm?email=${encodeURIComponent(email)}&error=auth_failed${nativeQuery}`,
      303,
    );
  }
}

function buildNativeQuery(redirectUri: string, state: string | null): string {
  if (redirectUri !== "tastile://auth/callback" || !state) return "";
  return `&redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(state)}`;
}

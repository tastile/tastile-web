import { tryGetCognitoEnv } from "@/lib/cognito/env";
import { normalizeEmail } from "@/lib/cognito/form";
import { safeOAuthRedirectUri, safePkceValue } from "@/lib/cognito/login-url";
import { resendConfirmationCode } from "@/lib/cognito/public-client";
import { getCognitoPublicOrigin } from "@/lib/cognito/public-origin";
import { type NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const env = tryGetCognitoEnv();
  const origin = getCognitoPublicOrigin(env?.callbackUrl);
  if (!env) return NextResponse.redirect(`${origin}/login?error=cognito_not_configured`, 303);

  const form = await request.formData();
  const email = normalizeEmail(form.get("email"));
  const nativeQuery = buildNativeQuery(
    safeOAuthRedirectUri(form.get("redirect_uri")?.toString() ?? null, env.callbackUrl),
    safePkceValue(form.get("state")?.toString() ?? null),
  );
  if (!email)
    return NextResponse.redirect(`${origin}/auth/confirm?error=missing_email${nativeQuery}`, 303);

  try {
    await resendConfirmationCode(env, email);
    return NextResponse.redirect(
      `${origin}/auth/confirm?email=${encodeURIComponent(email)}&notice=sent${nativeQuery}`,
      303,
    );
  } catch (error) {
    console.error("Resend confirmation failed", error);
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

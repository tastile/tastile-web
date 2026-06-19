import { type NextRequest, NextResponse } from "next/server";
import { tryGetCognitoEnv } from "@/lib/cognito/env";
import { normalizeEmail } from "@/lib/cognito/form";
import { safeOAuthRedirectUri, safePkceValue } from "@/lib/cognito/login-url";
import { CognitoPublicError, signUpPasswordlessEmail } from "@/lib/cognito/public-client";
import { getCognitoPublicOrigin } from "@/lib/cognito/public-origin";

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
    return NextResponse.redirect(`${origin}/auth/signup?error=missing_email${nativeQuery}`, 303);

  try {
    await signUpPasswordlessEmail(env, email);
    return NextResponse.redirect(
      `${origin}/auth/confirm?email=${encodeURIComponent(email)}&notice=sent${nativeQuery}`,
      303,
    );
  } catch (error) {
    if (error instanceof CognitoPublicError && error.code === "UsernameExistsException") {
      return NextResponse.redirect(
        `${origin}/auth/confirm?email=${encodeURIComponent(email)}&error=user_exists${nativeQuery}`,
        303,
      );
    }
    console.error("Passwordless signup failed", error);
    return NextResponse.redirect(`${origin}/auth/signup?error=auth_failed${nativeQuery}`, 303);
  }
}

function buildNativeQuery(redirectUri: string, state: string | null): string {
  if (redirectUri !== "tastile://auth/callback" || !state) return "";
  return `&redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(state)}`;
}

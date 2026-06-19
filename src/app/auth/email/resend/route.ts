import { type NextRequest, NextResponse } from "next/server";
import { tryGetCognitoEnv } from "@/lib/cognito/env";
import { normalizeEmail } from "@/lib/cognito/form";
import { resendConfirmationCode } from "@/lib/cognito/public-client";
import { getCognitoPublicOrigin } from "@/lib/cognito/public-origin";

export async function POST(request: NextRequest) {
  const env = tryGetCognitoEnv();
  const origin = getCognitoPublicOrigin(env?.callbackUrl);
  if (!env) return NextResponse.redirect(`${origin}/login?error=cognito_not_configured`, 303);

  const form = await request.formData();
  const email = normalizeEmail(form.get("email"));
  if (!email) return NextResponse.redirect(`${origin}/auth/confirm?error=missing_email`, 303);

  try {
    await resendConfirmationCode(env, email);
    return NextResponse.redirect(
      `${origin}/auth/confirm?email=${encodeURIComponent(email)}&notice=sent`,
      303,
    );
  } catch (error) {
    console.error("Resend confirmation failed", error);
    return NextResponse.redirect(
      `${origin}/auth/confirm?email=${encodeURIComponent(email)}&error=auth_failed`,
      303,
    );
  }
}

import { updateCognitoUserEmail } from "@/shared/auth/account-client";
import { getAccountAccessToken } from "@/shared/auth/account-session";
import { tryGetCognitoEnv } from "@/shared/auth/env";
import { normalizeEmail } from "@/shared/auth/form";
import { type NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const env = tryGetCognitoEnv();
  if (!env) return NextResponse.json({ error: "cognito_not_configured" }, { status: 500 });

  const form = await request.formData();
  const email = normalizeEmail(form.get("email"));
  if (!email) return NextResponse.json({ error: "missing_email" }, { status: 400 });

  const response = NextResponse.json({ ok: true });
  const accessToken = await getAccountAccessToken(response);
  if (!accessToken) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  try {
    await updateCognitoUserEmail(env, accessToken, email);
    for (const cookie of response.cookies.getAll()) {
      response.cookies.set(cookie);
    }
    return response;
  } catch (error) {
    console.error("Cognito UpdateUserAttributes email failed", error);
    return NextResponse.json({ error: "email_update_failed" }, { status: 502 });
  }
}

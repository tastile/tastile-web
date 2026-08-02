import { associateSoftwareToken } from "@/shared/auth/associate-software-token";
import { COOKIE_EMAIL_AUTH_SESSION, COOKIE_EMAIL_AUTH_USERNAME } from "@/shared/auth/cookies";
import { tryGetCognitoEnv } from "@/shared/auth/env";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function POST() {
  const env = tryGetCognitoEnv();
  if (!env) {
    return NextResponse.json({ error: "no_cognito" }, { status: 500 });
  }

  const cookieStore = await cookies();
  const session = cookieStore.get(COOKIE_EMAIL_AUTH_SESSION)?.value;
  if (!session) {
    return NextResponse.json(
      { error: "Missing MFA setup session. Please restart sign-in." },
      { status: 400 },
    );
  }

  try {
    const { secretCode, session: newSession } = await associateSoftwareToken(env, session);

    const issuer = "Tastile";
    const accountName = cookieStore.get(COOKIE_EMAIL_AUTH_USERNAME)?.value ?? "user";
    const otpauthUrl =
      `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(accountName)}` +
      `?secret=${secretCode}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;

    const response = NextResponse.json({ secretCode, otpauthUrl });
    response.cookies.set(COOKIE_EMAIL_AUTH_SESSION, newSession, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 600,
    });
    return response;
  } catch (error) {
    console.error("AssociateSoftwareToken failed", error);
    const message = error instanceof Error ? error.message : "unknown_error";
    return NextResponse.json({ error: "cognito_error", message }, { status: 500 });
  }
}

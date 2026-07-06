import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { tryGetCognitoEnv } from "@/lib/cognito/env";
import { finalizeMfaSetup } from "@/lib/cognito/finalize-mfa-setup";
import { verifySoftwareToken } from "@/lib/cognito/verify-software-token";
import {
  COOKIE_EMAIL_AUTH_SESSION,
  COOKIE_EMAIL_AUTH_USERNAME,
  setAuthCookies,
} from "@/lib/cognito/cookies";
import { parseIdTokenClaims } from "@/lib/cognito/server";

export async function POST(request: Request) {
  const env = tryGetCognitoEnv();
  if (!env) {
    return NextResponse.json({ error: "no_cognito" }, { status: 500 });
  }

  const cookieStore = await cookies();
  const session = cookieStore.get(COOKIE_EMAIL_AUTH_SESSION)?.value;
  const email = cookieStore.get(COOKIE_EMAIL_AUTH_USERNAME)?.value;
  if (!session) {
    return NextResponse.json(
      { error: "Missing MFA verify session. Please restart sign-in." },
      { status: 400 },
    );
  }
  if (!email) {
    return NextResponse.json(
      { error: "Missing MFA verify email. Please restart sign-in." },
      { status: 400 },
    );
  }

  const form = await request.formData();
  const code = form.get("code")?.toString().trim() ?? "";
  if (!/^[0-9]{6}$/.test(code)) {
    return NextResponse.json({ error: "invalid_code_format" }, { status: 400 });
  }

  try {
    const verify = await verifySoftwareToken(env, session, code);
    const tokens = await finalizeMfaSetup(env, verify.session, email);
    const claims = parseIdTokenClaims(tokens.idToken);

    const response = NextResponse.json({
      ok: true,
      idToken: tokens.idToken,
      expiresIn: tokens.expiresIn,
    });
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
    console.error("VerifySoftwareToken failed", error);
    const message = error instanceof Error ? error.message : "unknown_error";
    if (
      message.includes("CodeMismatch") ||
      message.includes("CodeMismatchException")
    ) {
      return NextResponse.json({ error: "code_mismatch", message }, { status: 401 });
    }
    return NextResponse.json({ error: "cognito_error", message }, { status: 500 });
  }
}

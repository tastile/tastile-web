import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { setAuthCookies } from "@/lib/cognito/cookies";
import { tryGetCognitoEnv } from "@/lib/cognito/env";
import { parseIdTokenClaims } from "@/lib/cognito/server";
import { verifySoftwareToken } from "@/lib/cognito/verify-software-token";
import { COOKIE_EMAIL_AUTH_SESSION } from "@/lib/cognito/cookies";

export async function POST(request: Request) {
  const env = tryGetCognitoEnv();
  if (!env) {
    return NextResponse.json({ error: "no_cognito" }, { status: 500 });
  }

  const cookieStore = await cookies();
  const session = cookieStore.get(COOKIE_EMAIL_AUTH_SESSION)?.value;
  if (!session) {
    return NextResponse.json(
      { error: "Missing MFA verify session. Please restart sign-in." },
      { status: 400 },
    );
  }

  const form = await request.formData();
  const code = form.get("code")?.toString().trim() ?? "";
  if (!/^[0-9]{6}$/.test(code)) {
    return NextResponse.json({ error: "invalid_code_format" }, { status: 400 });
  }

  try {
    const result = await verifySoftwareToken(env, session, code);

    if (result.challengeName === "MFA_SETUP" && result.session) {
      const response = NextResponse.json({ challengeName: "MFA_SETUP" }, { status: 202 });
      response.cookies.set(COOKIE_EMAIL_AUTH_SESSION, result.session, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 600,
      });
      return response;
    }

    if (!result.idToken || !result.accessToken) {
      return NextResponse.json(
        { error: "mfa_verify_no_tokens" },
        { status: 502 },
      );
    }

    const claims = parseIdTokenClaims(result.idToken);
    const response = NextResponse.json({
      ok: true,
      idToken: result.idToken,
      expiresIn: result.expiresIn,
    });
    await setAuthCookies(
      {
        idToken: result.idToken,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        sub: claims.sub,
        expiresIn: result.expiresIn,
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
    return NextResponse.json({ error: "cognito_error", message }, { status: 502 });
  }
}
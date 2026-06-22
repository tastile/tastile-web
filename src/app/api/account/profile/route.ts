import { NextResponse } from "next/server";
import { getCognitoUser } from "@/lib/cognito/account-client";
import { getAccountAccessToken, getAccountIdTokenClaims } from "@/lib/cognito/account-session";
import { tryGetCognitoEnv } from "@/lib/cognito/env";

export async function GET() {
  const env = tryGetCognitoEnv();
  if (!env) return NextResponse.json({ error: "cognito_not_configured" }, { status: 500 });

  const response = NextResponse.json({});
  const accessToken = await getAccountAccessToken(response);
  if (!accessToken) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  try {
    const profile = await getCognitoUser(env, accessToken);
    const claims = await getAccountIdTokenClaims();
    const sub = claims?.sub ?? null;
    const json = NextResponse.json({ profile: { ...profile, sub } });
    for (const cookie of response.cookies.getAll()) {
      json.cookies.set(cookie);
    }
    return json;
  } catch (error) {
    console.error("Cognito GetUser failed", error);
    const claims = await getAccountIdTokenClaims();
    if (!claims) return NextResponse.json({ error: "profile_failed" }, { status: 502 });
    const json = NextResponse.json({
      profile: {
        username: claims.preferredUsername ?? claims.email ?? claims.sub,
        sub: claims.sub,
        email: claims.email ?? null,
        emailVerified: claims.emailVerified ?? false,
        preferredUsername: claims.preferredUsername ?? null,
      },
    });
    for (const cookie of response.cookies.getAll()) {
      json.cookies.set(cookie);
    }
    return json;
  }
}

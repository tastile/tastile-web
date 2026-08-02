import { verifyCognitoAccessToken } from "@/shared/auth/access-token-verification";
import { getAccountAccessToken, getAccountIdTokenClaims } from "@/shared/auth/account-session";
import { tryGetCognitoEnv } from "@/shared/auth/env";
import { NextResponse } from "next/server";

export async function GET() {
  const env = tryGetCognitoEnv();
  if (!env) return NextResponse.json({ error: "cognito_not_configured" }, { status: 500 });

  const response = NextResponse.json({});
  const accessToken = await getAccountAccessToken(response);
  if (!accessToken) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  const sub = await verifyCognitoAccessToken({ accessToken, env });
  if (!sub) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  // Read profile attributes from the id_token (sub, email, email_verified,
  // preferred_username). The id_token was validated by Cognito at issuance,
  // and /oauth2/userInfo above already proved the access_token is alive.
  // Avoid calling GetUser: its strict scope/region requirements reject
  // tokens that userInfo accepts, making the profile unviewable.
  const claims = await getAccountIdTokenClaims();
  const profile = {
    username: claims?.preferredUsername ?? sub,
    email: claims?.email ?? null,
    emailVerified: claims?.emailVerified ?? false,
    userStatus: null as string | null,
    preferredUsername: claims?.preferredUsername ?? null,
  };

  const json = NextResponse.json({ profile: { ...profile, sub } });
  for (const cookie of response.cookies.getAll()) {
    json.cookies.set(cookie);
  }
  return json;
}

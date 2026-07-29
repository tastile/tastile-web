import { clearAuthCookies } from "@/lib/cognito/cookies";
import { tryGetCognitoEnv } from "@/lib/cognito/env";
import { getCognitoPublicOrigin } from "@/lib/cognito/public-origin";
import { NextResponse } from "next/server";

export async function GET() {
  const env = tryGetCognitoEnv();
  await clearAuthCookies();
  if (!env) return NextResponse.redirect(getCognitoPublicOrigin());
  const url = new URL(`${env.hostedUiBaseUrl}/logout`);
  url.searchParams.set("client_id", env.clientId);
  url.searchParams.set("logout_uri", env.logoutUrl);
  return NextResponse.redirect(url);
}

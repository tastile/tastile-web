import { clearAuthCookies } from "@/shared/auth/cookies";
import { tryGetCognitoEnv } from "@/shared/auth/env";
import { getCognitoPublicOrigin } from "@/shared/auth/public-origin";
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

import { type NextRequest, NextResponse } from "next/server";

import { getAuth } from "@/shared/auth/better-auth/server";
import { clearTastileCookies } from "@/shared/auth/cookies";

// Server-side sign-out: revokes the BetterAuth session (its Set-Cookie is
// forwarded) and clears every Tastile-owned cookie, then returns to /.
export async function GET(request: NextRequest): Promise<NextResponse> {
  const response = NextResponse.redirect(new URL("/", request.url));
  try {
    const result = await getAuth().api.signOut({ headers: request.headers });
    const betterAuthHeaders = (result as { headers?: Headers }).headers;
    if (betterAuthHeaders && typeof betterAuthHeaders.getSetCookie === "function") {
      for (const cookie of betterAuthHeaders.getSetCookie()) {
        response.headers.append("set-cookie", cookie);
      }
    }
  } catch (error) {
    console.warn("[auth] signOut failed:", error);
  }
  await clearTastileCookies(response);
  return response;
}

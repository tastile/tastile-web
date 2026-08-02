import { COOKIE_API_TOKEN, COOKIE_DIRECT_DAEMON, COOKIE_USER_SUB } from "@/shared/auth/cookies";
import { type NextRequest, NextResponse } from "next/server";

const COOKIE_MAX_AGE_30_DAYS = 60 * 60 * 24 * 30;

function isLoggedIn(request: NextRequest): boolean {
  const apiToken = request.cookies.get(COOKIE_API_TOKEN)?.value;
  const userSub = request.cookies.get(COOKIE_USER_SUB)?.value;
  return Boolean(apiToken || userSub);
}

function cookieAttributes(): string {
  const isProd = process.env.NODE_ENV === "production";
  const parts = ["Path=/", "SameSite=Lax", `Max-Age=${COOKIE_MAX_AGE_30_DAYS}`];
  if (isProd) parts.push("Secure");
  return parts.join("; ");
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!isLoggedIn(request)) {
    return NextResponse.json({ error: "not authenticated" }, { status: 401 });
  }
  const response = NextResponse.json({ ok: true });
  response.headers.append("Set-Cookie", `${COOKIE_DIRECT_DAEMON}=1; ${cookieAttributes()}`);
  return response;
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  if (!isLoggedIn(request)) {
    return NextResponse.json({ error: "not authenticated" }, { status: 401 });
  }
  const isProd = process.env.NODE_ENV === "production";
  const parts = ["Path=/", "SameSite=Lax", "Max-Age=0"];
  if (isProd) parts.push("Secure");
  const response = NextResponse.json({ ok: true });
  response.headers.append("Set-Cookie", `${COOKIE_DIRECT_DAEMON}=; ${parts.join("; ")}`);
  return response;
}

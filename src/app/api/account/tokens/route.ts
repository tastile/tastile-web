import { NextResponse } from "next/server";
import { getUserSubFromCookies } from "@/lib/cognito/cookies";

const DEFAULT_CORE_URL = "http://127.0.0.1:3140";

export async function GET() {
  return proxyTokens();
}

export async function POST(request: Request) {
  return proxyTokens({ method: "POST", body: await request.text() });
}

async function proxyTokens(init?: { method?: string; body?: string }) {
  const userSub = await getUserSubFromCookies();
  const bridgeSecret = process.env.TASTILE_WEB_BRIDGE_SECRET;
  if (!userSub || !bridgeSecret) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const response = await fetch(`${coreUrl()}/auth/api-tokens`, {
    method: init?.method ?? "GET",
    headers: {
      "x-tastile-web-bridge-secret": bridgeSecret,
      "x-tastile-web-session-user": userSub,
      ...(init?.body ? { "content-type": "application/json" } : {}),
    },
    body: init?.body,
    cache: "no-store",
  });

  return forward(response);
}

async function forward(response: Response) {
  const text = await response.text();
  return new NextResponse(text, {
    status: response.status,
    headers: { "content-type": response.headers.get("content-type") ?? "application/json" },
  });
}

function coreUrl() {
  return (
    process.env.TASTILE_CORE_URL ??
    process.env.NEXT_PUBLIC_TASTILE_CORE_URL ??
    process.env.NEXT_PUBLIC_DAEMON_BASE_URL ??
    DEFAULT_CORE_URL
  ).replace(/\/$/, "");
}

import { NextResponse } from "next/server";
import { coreUrl, ensureDefaultApiToken, setApiTokenCookie } from "@/lib/account/api-token-session";
import { getAccountUserSub } from "@/lib/cognito/account-session";

export async function GET() {
  return proxyTokens();
}

export async function POST(request: Request) {
  return proxyTokens({ method: "POST", body: await request.text() });
}

async function proxyTokens(init?: { method?: string; body?: string }) {
  const shell = NextResponse.json({});
  await ensureDefaultApiToken(shell);
  const userSub = await getAccountUserSub();
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

  const createdBody =
    init?.method === "POST" && response.ok
      ? await response
          .clone()
          .json()
          .catch(() => null)
      : null;
  const forwarded = await forward(response);
  for (const cookie of shell.cookies.getAll()) {
    forwarded.cookies.set(cookie);
  }
  if (createdBody && typeof (createdBody as { access_token?: unknown }).access_token === "string") {
    setApiTokenCookie((createdBody as { access_token: string }).access_token, forwarded);
  }
  return forwarded;
}

async function forward(response: Response) {
  const text = await response.text();
  return new NextResponse(text, {
    status: response.status,
    headers: { "content-type": response.headers.get("content-type") ?? "application/json" },
  });
}

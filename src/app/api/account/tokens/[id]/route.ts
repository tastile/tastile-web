import { NextResponse } from "next/server";
import { getAccountUserSub } from "@/lib/cognito/account-session";
import { coreUrl, ensureDefaultApiToken } from "@/lib/account/api-token-session";

type Context = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: Context) {
  const { id } = await context.params;
  return proxyToken(id, { method: "PATCH", body: await request.text() });
}

export async function DELETE(_request: Request, context: Context) {
  const { id } = await context.params;
  return proxyToken(id, { method: "DELETE" });
}

async function proxyToken(id: string, init: { method: string; body?: string }) {
  const shell = NextResponse.json({});
  await ensureDefaultApiToken(shell);
  const userSub = await getAccountUserSub();
  const bridgeSecret = process.env.TASTILE_WEB_BRIDGE_SECRET;
  if (!userSub || !bridgeSecret) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const response = await fetch(`${coreUrl()}/auth/api-tokens/${encodeURIComponent(id)}`, {
    method: init.method,
    headers: {
      "x-tastile-web-bridge-secret": bridgeSecret,
      "x-tastile-web-session-user": userSub,
      ...(init.body ? { "content-type": "application/json" } : {}),
    },
    body: init.body,
    cache: "no-store",
  });

  const text = await response.text();
  const forwarded = new NextResponse(text, {
    status: response.status,
    headers: { "content-type": response.headers.get("content-type") ?? "application/json" },
  });
  for (const cookie of shell.cookies.getAll()) {
    forwarded.cookies.set(cookie);
  }
  return forwarded;
}

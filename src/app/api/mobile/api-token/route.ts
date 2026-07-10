import { NextResponse } from "next/server";
import { coreUrl } from "@/lib/account/api-token-session";
import { verifyCognitoAccessToken } from "@/lib/cognito/access-token-verification";
import { tryGetCognitoEnv } from "@/lib/cognito/env";

export async function POST(request: Request) {
  const accessToken = bearerToken(request.headers.get("authorization"));
  const env = tryGetCognitoEnv();
  if (!accessToken || !env) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const userSub = await verifyCognitoAccessToken({ accessToken, env });
  if (!userSub) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const bridgeSecret = process.env.TASTILE_WEB_BRIDGE_SECRET;
  if (!bridgeSecret) {
    return NextResponse.json({ error: "bridge_not_configured" }, { status: 503 });
  }

  const upstream = await fetch(`${coreUrl()}/v1/api-tokens`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-tastile-web-bridge-secret": bridgeSecret,
      "x-tastile-web-session-user": userSub,
    },
    body: JSON.stringify({ label: "android-client" }),
    cache: "no-store",
  });
  const text = await upstream.text();
  if (!upstream.ok) {
    return new NextResponse(text, {
      status: upstream.status,
      headers: { "content-type": upstream.headers.get("content-type") ?? "application/json" },
    });
  }

  const created = JSON.parse(text) as Record<string, unknown>;
  return NextResponse.json({
    ...created,
    token_id: created.token_id ?? created.id,
  });
}

function bearerToken(value: string | null): string | null {
  const match = value?.match(/^Bearer\s+(\S+)$/i);
  return match?.[1] ?? null;
}

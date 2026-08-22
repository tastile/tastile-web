import { coreUrl } from "@/lib/account/api-token-session";
import { getAuth } from "@/shared/auth/better-auth/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  // The bearer() plugin lets BetterAuth resolve a session from an
  // `Authorization: Bearer <sessionToken>` header, which is how native
  // clients (Android / desktop) authenticate against this route.
  let userSub: string | null = null;
  try {
    const session = await getAuth().api.getSession({ headers: request.headers });
    userSub = session?.user?.id ?? null;
  } catch (error) {
    console.warn("[mobile-api-token] session resolution failed:", error);
  }
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
  if (!upstream.ok) {
    const errorText = await upstream.text();
    return new NextResponse(errorText, {
      status: upstream.status,
      headers: { "content-type": upstream.headers.get("content-type") ?? "application/json" },
    });
  }

  const text = await upstream.text();
  const created = JSON.parse(text) as Record<string, unknown>;
  return NextResponse.json({
    ...created,
    token_id: created.token_id ?? created.id,
  });
}

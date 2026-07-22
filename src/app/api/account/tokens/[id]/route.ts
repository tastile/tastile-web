import { NextResponse } from "next/server";
import { coreUrl } from "@/lib/account/api-token-session";
import { getAccountUserSub } from "@/lib/cognito/account-session";

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
  const userSub = await getAccountUserSub();
  const bridgeSecret = process.env.TASTILE_WEB_BRIDGE_SECRET;
  if (!userSub || !bridgeSecret) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const response = await fetch(`${coreUrl()}/v1/api-tokens/${encodeURIComponent(id)}`, {
    method: init.method,
    headers: {
      "x-tastile-web-bridge-secret": bridgeSecret,
      "x-tastile-web-session-user": userSub,
      ...(init.body ? { "content-type": "application/json" } : {}),
    },
    body: init.body ? normalizeRequestBody(init.body) : undefined,
    cache: "no-store",
  });

  // Always forward the upstream response verbatim — including 4xx/5xx — so the client
  // sees the real status/body. Branching on ok makes the status check explicit.
  if (!response.ok) {
    const errorText = await response.text();
    return new NextResponse(normalizeResponseText(errorText), {
      status: response.status,
      headers: { "content-type": response.headers.get("content-type") ?? "application/json" },
    });
  }
  const text = await response.text();
  return new NextResponse(normalizeResponseText(text), {
    status: response.status,
    headers: { "content-type": response.headers.get("content-type") ?? "application/json" },
  });
}

function normalizeRequestBody(body: string) {
  try {
    const parsed = JSON.parse(body) as { name?: unknown; label?: unknown };
    if (typeof parsed.name === "string" && typeof parsed.label !== "string") {
      parsed.label = parsed.name;
      delete parsed.name;
    }
    return JSON.stringify(parsed);
  } catch {
    return body;
  }
}

function normalizeResponseText(text: string) {
  try {
    return JSON.stringify(toWebToken(JSON.parse(text)));
  } catch {
    return text;
  }
}

function toWebToken(token: unknown) {
  if (!token || typeof token !== "object") return token;
  const source = token as Record<string, unknown>;
  return {
    ...source,
    token_id: source.token_id ?? source.id,
    name: source.name ?? source.label,
    token_prefix: source.token_prefix ?? source.prefix,
    access_token: source.access_token ?? source.token,
    last_used_path: source.last_used_path ?? null,
  };
}

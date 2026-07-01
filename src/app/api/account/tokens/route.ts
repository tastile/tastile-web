import { NextResponse } from "next/server";
import {
  coreUrl,
  ensureDefaultApiTokenForUser,
  setApiTokenCookie,
} from "@/lib/account/api-token-session";
import { getAccountUserSub } from "@/lib/cognito/account-session";

export async function GET() {
  return proxyTokens();
}

export async function POST(request: Request) {
  return proxyTokens({ method: "POST", body: await request.text() });
}

async function proxyTokens(init?: { method?: string; body?: string }) {
  const shell = NextResponse.json({});
  const userSub = await getAccountUserSub();
  const bridgeSecret = process.env.TASTILE_WEB_BRIDGE_SECRET;
  if (!userSub || !bridgeSecret) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }
  await ensureDefaultApiTokenForUser(userSub, shell);

  const response = await fetch(`${coreUrl()}/v1/api-tokens`, {
    method: init?.method ?? "GET",
    headers: {
      "x-tastile-web-bridge-secret": bridgeSecret,
      "x-tastile-web-session-user": userSub,
      ...(init?.body ? { "content-type": "application/json" } : {}),
    },
    body: init?.body ? normalizeRequestBody(init.body) : undefined,
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
  if (createdBody && typeof (createdBody as { token?: unknown }).token === "string") {
    setApiTokenCookie((createdBody as { token: string }).token, forwarded);
  }
  return forwarded;
}

async function forward(response: Response) {
  const text = await response.text();
  const normalized = normalizeResponseText(text);
  return new NextResponse(normalized, {
    status: response.status,
    headers: { "content-type": response.headers.get("content-type") ?? "application/json" },
  });
}

function normalizeRequestBody(body: string) {
  try {
    const parsed = JSON.parse(body) as { name?: unknown; label?: unknown; scopes?: unknown };
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
    const parsed = JSON.parse(text);
    return JSON.stringify(Array.isArray(parsed) ? parsed.map(toWebToken) : toWebToken(parsed));
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

import { cookies } from "next/headers";
import type { NextRequest, NextResponse } from "next/server";
import { COOKIE_API_TOKEN } from "@/lib/cognito/cookies";
import { getAccountUserSub } from "@/lib/cognito/account-session";

const DEFAULT_CORE_URL = "http://127.0.0.1:3140";
const DEFAULT_TOKEN_NAME = "Default API key";
const TOKEN_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
const bootstrapLocks = new Map<string, Promise<string | null>>();

type ApiTokenView = {
  token_id: string;
  name: string;
  revoked_at: string | null;
};

type CreatedApiToken = ApiTokenView & {
  access_token: string;
};

export async function getApiTokenFromCookies(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(COOKIE_API_TOKEN)?.value ?? null;
}

export function getApiTokenFromRequest(request: NextRequest): string | null {
  return request.cookies.get(COOKIE_API_TOKEN)?.value ?? null;
}

export async function ensureDefaultApiToken(response?: NextResponse): Promise<string | null> {
  const existing = await getApiTokenFromCookies();
  if (existing) return existing;

  const userSub = await getAccountUserSub();
  return ensureDefaultApiTokenForUser(userSub, response);
}

export async function ensureDefaultApiTokenForUser(
  userSub: string | null,
  response?: NextResponse,
): Promise<string | null> {
  if (!userSub) return null;
  const existingLock = bootstrapLocks.get(userSub);
  if (existingLock) {
    const token = await existingLock;
    if (token && response) setApiTokenCookie(token, response);
    return token;
  }

  const lock = createDefaultApiTokenForUser(userSub, response).finally(() => {
    bootstrapLocks.delete(userSub);
  });
  bootstrapLocks.set(userSub, lock);
  return lock;
}

async function createDefaultApiTokenForUser(
  userSub: string,
  response?: NextResponse,
): Promise<string | null> {
  const bridgeSecret = process.env.TASTILE_WEB_BRIDGE_SECRET;
  if (!bridgeSecret) return null;

  const headers = {
    "x-tastile-web-bridge-secret": bridgeSecret,
    "x-tastile-web-session-user": userSub,
  };
  const listResponse = await fetch(`${coreUrl()}/auth/api-tokens`, {
    method: "GET",
    headers,
    cache: "no-store",
  });
  if (!listResponse.ok) return null;

  const tokens = (await listResponse.json()) as ApiTokenView[];
  const activeDefault = tokens.find((token) => token.name === DEFAULT_TOKEN_NAME && !token.revoked_at);
  if (activeDefault) return null;

  const createResponse = await fetch(`${coreUrl()}/auth/api-tokens`, {
    method: "POST",
    headers: {
      ...headers,
      "content-type": "application/json",
    },
    body: JSON.stringify({ name: DEFAULT_TOKEN_NAME }),
    cache: "no-store",
  });
  if (!createResponse.ok) return null;

  const created = (await createResponse.json()) as CreatedApiToken;
  setApiTokenCookie(created.access_token, response);
  return created.access_token;
}

export function setApiTokenCookie(token: string, response?: NextResponse): void {
  const target = response?.cookies;
  if (!target) return;
  target.set(COOKIE_API_TOKEN, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: TOKEN_COOKIE_MAX_AGE,
  });
}

export function coreUrl() {
  return (
    process.env.TASTILE_CORE_URL ??
    process.env.NEXT_PUBLIC_TASTILE_CORE_URL ??
    process.env.NEXT_PUBLIC_DAEMON_BASE_URL ??
    DEFAULT_CORE_URL
  ).replace(/\/$/, "");
}

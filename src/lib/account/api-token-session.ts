import { getCloudApiBase } from "@/lib/upstream/cloud-api-base";
import { COOKIE_API_TOKEN } from "@/shared/auth/cookies";
import { cookies } from "next/headers";
import type { NextRequest, NextResponse } from "next/server";

// Name used when registering the per-login session token. The plaintext
// `access_token` is only ever returned at this POST — afterwards the server
// only retains its hash, so the client must keep the cookie or re-login.
const SESSION_TOKEN_NAME = "Web session";
const TOKEN_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
const bootstrapLocks = new Map<string, Promise<string | null>>();

type CreatedApiToken = {
  id: string;
  label: string;
  revoked_at: string | null;
  token: string;
};

export async function getApiTokenFromCookies(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(COOKIE_API_TOKEN)?.value ?? null;
}

export function getApiTokenFromRequest(request: NextRequest): string | null {
  const auth = request.headers.get("authorization");
  if (auth) {
    const m = /^Bearer\s+(\S+)$/i.exec(auth);
    if (m) return m[1];
  }
  return request.cookies.get(COOKIE_API_TOKEN)?.value ?? null;
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
  const createResponse = await fetch(`${coreUrl()}/v1/api-tokens`, {
    method: "POST",
    headers: {
      ...headers,
      "content-type": "application/json",
    },
    body: JSON.stringify({ label: SESSION_TOKEN_NAME }),
    cache: "no-store",
  });
  if (!createResponse.ok) return null;

  const created = (await createResponse.json()) as CreatedApiToken;
  setApiTokenCookie(created.token, response);
  return created.token;
}

function setApiTokenCookie(token: string, response?: NextResponse): void {
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

const BROWSER_TOKEN_NAME = "Web browser session";

export interface MintedBrowserToken {
  token: string;
  expiresAt: string;
}

// Mints a token the browser may hold in memory to call tastile-core directly.
// It carries an explicit `expires_at` so core rejects it after the TTL
// (verified in crates-v1/api/src/handlers/common.rs bearer_auth_result).
export async function mintBrowserApiToken(
  userSub: string,
  ttlSeconds: number,
): Promise<MintedBrowserToken | null> {
  const bridgeSecret = process.env.TASTILE_WEB_BRIDGE_SECRET;
  if (!bridgeSecret) return null;

  const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
  const createResponse = await fetch(`${coreUrl()}/v1/api-tokens`, {
    method: "POST",
    headers: {
      "x-tastile-web-bridge-secret": bridgeSecret,
      "x-tastile-web-session-user": userSub,
      "content-type": "application/json",
    },
    body: JSON.stringify({ label: BROWSER_TOKEN_NAME, expires_at: expiresAt }),
    cache: "no-store",
  });
  if (!createResponse.ok) return null;

  const created = (await createResponse.json()) as CreatedApiToken;
  return { token: created.token, expiresAt };
}

export function coreUrl() {
  const value =
    process.env.TASTILE_CORE_URL?.trim() ??
    process.env.NEXT_PUBLIC_TASTILE_CORE_URL?.trim() ??
    process.env.NEXT_PUBLIC_DAEMON_BASE_URL?.trim() ??
    getCloudApiBase({ assert: true });
  return value.replace(/\/$/, "");
}

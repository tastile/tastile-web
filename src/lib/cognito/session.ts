"use client";

export interface BrowserCognitoSession {
  sub: string;
  exp: number;
  ownerId: string | null;
}

let cachedSession: BrowserCognitoSession | null = null;

export async function getCognitoSessionClient(
  force = false,
): Promise<BrowserCognitoSession | null> {
  const now = Math.floor(Date.now() / 1000);
  if (!force && cachedSession && cachedSession.exp > now + 30) {
    return cachedSession;
  }

  let response: Response;
  try {
    response = await fetch(resolveSessionUrl(), {
      method: "GET",
      headers: { accept: "application/json" },
      cache: "no-store",
    });
  } catch {
    cachedSession = null;
    return null;
  }
  if (!response.ok) {
    cachedSession = null;
    return null;
  }

  const payload = (await response.json()) as Record<string, unknown>;
  if (typeof payload.sub !== "string") {
    cachedSession = null;
    return null;
  }

  cachedSession = {
    sub: payload.sub,
    exp: typeof payload.exp === "number" ? payload.exp : 0,
    ownerId: typeof payload.owner_id === "string" ? payload.owner_id : null,
  };
  return cachedSession;
}

function resolveSessionUrl(): string {
  if (typeof window === "undefined") {
    return "/api/auth/session";
  }
  return new URL("/api/auth/session", window.location.origin).toString();
}

export function clearCachedCognitoSession() {
  cachedSession = null;
}

"use client";

export interface BrowserCognitoSession {
  idToken: string;
  accessToken: string;
  expiresAt: number;
  userSub: string;
  email: string | null;
}

let cachedSession: BrowserCognitoSession | null = null;

export async function getIdTokenClient(force = false): Promise<string | null> {
  const session = await getCognitoSessionClient(force);
  return session?.idToken ?? null;
}

export async function getCognitoSessionClient(
  force = false,
): Promise<BrowserCognitoSession | null> {
  const now = Math.floor(Date.now() / 1000);
  if (!force && cachedSession && cachedSession.expiresAt > now + 30) {
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

  const payload = (await response.json()) as Partial<BrowserCognitoSession>;
  if (!payload.idToken || typeof payload.expiresAt !== "number" || !payload.userSub) {
    cachedSession = null;
    return null;
  }

  cachedSession = {
    idToken: payload.idToken,
    accessToken: payload.accessToken ?? "",
    expiresAt: payload.expiresAt,
    userSub: payload.userSub,
    email: payload.email ?? null,
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

"use client";

// Holds the tastile-core bearer token for direct browser calls.
//
// Memory only: writing this to localStorage / sessionStorage / a JS-readable
// cookie would turn any XSS into a persistent credential leak. The token dies
// with the tab.

const BOOTSTRAP_PATH = "/api/auth/core-token";
// Refresh ahead of expiry so a long-running page never sends a dead token.
const REFRESH_MARGIN_MS = 60 * 1000;

interface CoreTokenState {
  token: string;
  expiresAtMs: number;
}

let cached: CoreTokenState | null = null;
let inFlight: Promise<string | null> | null = null;

async function bootstrap(): Promise<string | null> {
  const response = await fetch(BOOTSTRAP_PATH, {
    credentials: "include",
    cache: "no-store",
  });
  if (!response.ok) return null;
  const body = (await response.json()) as { token?: string; expiresAt?: string };
  if (!body.token || !body.expiresAt) return null;
  const expiresAtMs = Date.parse(body.expiresAt);
  if (!Number.isFinite(expiresAtMs)) return null;
  cached = { token: body.token, expiresAtMs };
  return body.token;
}

export async function getCoreToken(): Promise<string | null> {
  if (cached && cached.expiresAtMs - REFRESH_MARGIN_MS > Date.now()) {
    return cached.token;
  }
  // Concurrent callers on first render share one bootstrap request.
  inFlight ??= bootstrap().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

export function clearCoreToken(): void {
  cached = null;
}

// Called after a 401 so the next request re-bootstraps instead of replaying a
// token core has already rejected.
export async function refreshCoreToken(): Promise<string | null> {
  clearCoreToken();
  return getCoreToken();
}

import { headers } from "next/headers";

import { getAuth } from "./better-auth/server";

// Server-side session resolution on top of BetterAuth (ADR 2026-08-22).
// Replaces the former Cognito access-token verification: the session cookie
// is verified by the BetterAuth core against its own store, so no external
// JWKS / userInfo round-trip is involved.

export interface AuthenticatedSessionUser {
  id: string;
  email: string | null;
  name: string | null;
  emailVerified: boolean;
  /** Session expiry as a Unix epoch in **seconds**, or null when unknown. */
  expiresAtEpochSeconds: number | null;
}

export async function resolveAuthenticatedSession(
  args?: { requestHeaders?: Headers },
): Promise<AuthenticatedSessionUser | null> {
  const requestHeaders = args?.requestHeaders ?? (await headers());
  try {
    const session = await getAuth().api.getSession({ headers: requestHeaders });
    if (!session?.user) return null;
    const expiresAt = session.session?.expiresAt;
    return {
      id: session.user.id,
      email: session.user.email ?? null,
      name: session.user.name ?? null,
      emailVerified:
        typeof session.user.emailVerified === "boolean" ? session.user.emailVerified : false,
      expiresAtEpochSeconds:
        expiresAt instanceof Date && !Number.isNaN(expiresAt.getTime())
          ? Math.floor(expiresAt.getTime() / 1000)
          : null,
    };
  } catch (error) {
    // Fail closed: any resolver error means "no authenticated session".
    console.warn("[auth] getSession failed:", error);
    return null;
  }
}

export async function resolveAuthenticatedUserSub(
  args?: { requestHeaders?: Headers },
): Promise<string | null> {
  return (await resolveAuthenticatedSession(args))?.id ?? null;
}
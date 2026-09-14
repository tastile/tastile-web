import { v5 as uuidv5 } from "uuid";

import { headers } from "next/headers";

import { getAuth } from "./better-auth/server";

// Local-dev / CI bypass: when E2E_BYPASS_AUTH=1, return a synthetic
// BetterAuth-compatible session so the dashboard subscription UI
// (SubscriptionSection → /api/billing/subscription) renders the free
// branch without requiring a live BetterAuth cookie store.  Mirrors
// the same bypass in src/shared/auth/account-session.ts
// (DEV_ACTOR_SUBJECT_ID) so all server-side helpers agree on the
// free-user identity.  Production builds (E2E_BYPASS_AUTH unset)
// always go through getAuth().api.getSession() with the real cookie.
const NAMESPACE_OID = "6ba7b812-9dad-11d1-80b4-00c04fd430c8";
const E2E_BYPASS_USER_ID = "00000000-0000-0000-0000-000000000001";
const E2E_BYPASS_USER_SUB = uuidv5(E2E_BYPASS_USER_ID, NAMESPACE_OID);

function e2eBypassSession(): AuthenticatedSessionUser {
  return {
    id: E2E_BYPASS_USER_ID,
    email: "e2e-bypass@tastile.test",
    name: "E2E Bypass",
    emailVerified: true,
    expiresAtEpochSeconds: null,
  };
}

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
  if (process.env.E2E_BYPASS_AUTH === "1") return e2eBypassSession();
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
  if (process.env.E2E_BYPASS_AUTH === "1") return E2E_BYPASS_USER_SUB;
  return (await resolveAuthenticatedSession(args))?.id ?? null;
}
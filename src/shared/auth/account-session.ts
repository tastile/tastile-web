import { v5 as uuidv5 } from "uuid";

import { resolveAuthenticatedSession, resolveAuthenticatedUserSub } from "./authenticated-session";

// RFC 4122 NAMESPACE_OID — must match the daemon's bridge derivation
// (crates-v1/api/src/handlers/common.rs bridge_auth_from_headers).
const NAMESPACE_OID = "6ba7b812-9dad-11d1-80b4-00c04fd430c8";

// Local-dev bypass: when E2E_BYPASS_AUTH=1, the proxy and /api/auth/session
// synthesize a fixed owner_id. Mirror that here so all server-side helpers
// that derive the owner id (e.g. /api/me, billing) agree without needing a
// live BetterAuth session. Keep this UUID in sync with
// src/app/api/proxy/[...path]/route.ts and src/app/api/auth/session/route.ts.
const DEV_ACTOR_SUBJECT_ID = "00000000-0000-0000-0000-000000000001";

/** Better-auth user id of the caller (bridge identity). */
export async function getAccountUserSub(): Promise<string | null> {
  return resolveAuthenticatedUserSub();
}

/**
 * v1 owner id derived from the authenticated identity via
 * UUIDv5(NAMESPACE_OID, user id) — byte-for-byte identical to the core-side
 * bridge derivation.
 */
export async function getAccountOwnerId(): Promise<string | null> {
  if (process.env.E2E_BYPASS_AUTH === "1") return DEV_ACTOR_SUBJECT_ID;
  const session = await resolveAuthenticatedSession();
  if (!session?.id) return null;
  return uuidv5(session.id, NAMESPACE_OID);
}

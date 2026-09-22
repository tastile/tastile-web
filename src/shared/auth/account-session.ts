import {
  resolveAuthenticatedSession,
  resolveAuthenticatedUserSub,
  type AuthenticatedSessionUser,
} from "./authenticated-session";
import { isE2EBypassEnabled } from "@/shared/config/runtime-env";

// RFC 4122 NAMESPACE_OID — must match the daemon's bridge derivation
// (crates-v1/api/src/handlers/common.rs bridge_auth_from_headers).
const NAMESPACE_OID_BYTES = new Uint8Array([
  0x6b, 0xa7, 0xb8, 0x12, 0x9d, 0xad, 0x11, 0xd1,
  0x80, 0xb4, 0x00, 0xc0, 0x4f, 0xd4, 0x30, 0xc8,
]);

// Local-dev bypass: when E2E_BYPASS_AUTH=1, the proxy and /api/auth/session
// synthesize a fixed owner_id. Mirror that here so all server-side helpers
// that derive the owner id (e.g. /api/me, billing) agree without needing a
// live BetterAuth session. Keep this UUID in sync with
// src/app/api/proxy/[...path]/route.ts and src/app/api/auth/session/route.ts.
const DEV_ACTOR_SUBJECT_ID = "00000000-0000-0000-0000-000000000001";

function formatUuid(bytes: Uint8Array): string {
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

async function deriveOwnerId(userId: string): Promise<string> {
  const name = new TextEncoder().encode(userId);
  const input = new Uint8Array(NAMESPACE_OID_BYTES.length + name.length);
  input.set(NAMESPACE_OID_BYTES);
  input.set(name, NAMESPACE_OID_BYTES.length);
  const digest = new Uint8Array(await globalThis.crypto.subtle.digest("SHA-1", input));
  digest[6] = (digest[6] & 0x0f) | 0x50;
  digest[8] = (digest[8] & 0x3f) | 0x80;
  return formatUuid(digest.slice(0, 16));
}

/** Better-auth user id of the caller (bridge identity). */
export async function getAccountUserSub(): Promise<string | null> {
  return resolveAuthenticatedUserSub();
}

/**
 * v1 owner id derived from the authenticated identity via
 * UUIDv5(NAMESPACE_OID, user id) — byte-for-byte identical to the core-side
 * bridge derivation.
 */
export async function getAccountOwnerId(args?: {
  session?: Pick<AuthenticatedSessionUser, "id"> | null;
}): Promise<string | null> {
  if (isE2EBypassEnabled()) return DEV_ACTOR_SUBJECT_ID;
  const session = args && "session" in args ? args.session : await resolveAuthenticatedSession();
  if (!session?.id) return null;
  return deriveOwnerId(session.id);
}

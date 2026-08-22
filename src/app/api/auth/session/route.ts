import { getAccountOwnerId } from "@/shared/auth/account-session";
import { resolveAuthenticatedSession } from "@/shared/auth/authenticated-session";

// Returns session metadata only after server-side BetterAuth verification.
// The response intentionally excludes every credential-bearing token.
//
// Auth boundary contract (see tastile-core/crates-v1/api/src/handlers/common.rs):
//  - The only authentication concerns are (1) BetterAuth login and (2) Tastile
//    API tokens. This route never returns BetterAuth or core tokens to
//    browser JavaScript.
//  - The Tastile API token is a separate v1 concern and is NOT mintable
//    from this session lookup. Clients that need an API token must call
//    the dedicated /v1/api-tokens endpoint after login (the web bridge does
//    this automatically at /api/auth/bridge).
//
// `sub` is the better-auth user id — the same value tastile-core receives as
// x-tastile-web-session-user and derives the v1 owner_id from via
// UUIDv5(NAMESPACE_OID, sub). owner_id is derived locally with that same
// function so no upstream round-trip is needed to populate it synchronously.

/**
 * Public response shape for /api/auth/session.  Intentionally excludes
 * any token so credentials cannot leak via this JSON.
 */
export interface SessionJson {
  sub: string;
  exp: number;
  owner_id: string | null;
}

/**
 * Pure helper that constructs the SessionJson payload. Kept separate from
 * `GET` so the response shape can be asserted without a Next.js request
 * context.
 */
export function buildSessionJson(args: {
  sub: string;
  exp: number | null;
  ownerId: string | null;
}): SessionJson {
  return {
    sub: args.sub,
    exp: args.exp ?? 0,
    owner_id: args.ownerId,
  };
}

// Local-dev bypass: when E2E_BYPASS_AUTH=1, mint a synthetic session so the
// dashboard renders without going through BetterAuth. Mirrors the constant in
// src/app/api/proxy/[...path]/route.ts so /api/auth/session and the proxy
// agree on the dev actor.
const DEV_ACTOR_SUBJECT_ID = "00000000-0000-0000-0000-000000000001";

export async function GET() {
  // Local-dev / CI bypass: skip BetterAuth entirely.
  if (process.env.E2E_BYPASS_AUTH === "1") {
    return Response.json(
      buildSessionJson({
        sub: "dev-bypass",
        exp: null,
        ownerId: DEV_ACTOR_SUBJECT_ID,
      }),
    );
  }

  const session = await resolveAuthenticatedSession();
  if (!session) {
    return Response.json({ error: "not authenticated" }, { status: 401 });
  }
  const ownerId = await getAccountOwnerId();
  return Response.json(
    buildSessionJson({
      sub: session.id,
      exp: session.expiresAtEpochSeconds,
      ownerId,
    }),
  );
}

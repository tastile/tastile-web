import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { resolveAuthenticatedUserSub } from "@/lib/cognito/authenticated-session";
import { COOKIE_ID_TOKEN, COOKIE_REFRESH_TOKEN } from "@/lib/cognito/cookies";
import { getCloudApiBase } from "@/lib/upstream/cloud-api-base";

// Returns session metadata only after server-side Cognito verification.
// The response intentionally excludes every credential-bearing token.
//
// Auth boundary contract (see tastile-core/crates/v1/api/src/handlers/common.rs):
//  - The only authentication concerns are (1) Cognito login and (2) Tastile
//    API tokens. This route must NOT return idToken / refreshToken to
//    browser JavaScript; those are stored in httpOnly cookies and must
//    remain httpOnly in practice.
//  - The Tastile API token is a separate v1 concern and is NOT mintable
//    from this session lookup. Clients that need an API token must call
//    the dedicated /v1/api-tokens endpoint after Cognito login.
//
// The Cognito access token is verified against the configured user pool's
// userInfo endpoint before the bridge receives a user sub. The id_token exp
// remains a display hint only and is never an authentication decision.
//
// We also resolve the v1 owner_id by hitting the daemon over the internal
// bridge (x-tastile-web-bridge-secret + x-tastile-web-session-user) so that
// `useCurrentActorSubjectId` can synchronously populate the actor on first
// render. The daemon has no /v1/auth/session GET handler, so we read
// `owner_id` from /v1/quota/tiles which is the cheapest endpoint that
// echoes it back.
//
// node-runtime: relies on Buffer for the base64 JWT-payload decode.

function coreBase(): string {
  return getCloudApiBase({ assert: true });
}
const BRIDGE_SECRET = process.env.TASTILE_WEB_BRIDGE_SECRET ?? "";

interface QuotaResponse {
  owner_id?: string;
}

async function resolveOwnerId(sub: string): Promise<string | null> {
  if (!BRIDGE_SECRET) return null;
  try {
    const res = await fetch(`${coreBase()}/v1/quota/tiles`, {
      method: "GET",
      cache: "no-store",
      headers: {
        "x-tastile-web-bridge-secret": BRIDGE_SECRET,
        "x-tastile-web-session-user": sub,
      },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as QuotaResponse;
    return typeof data.owner_id === "string" ? data.owner_id : null;
  } catch {
    return null;
  }
}

/**
 * Decoded JWT `exp` claim, best-effort.  Returns 0 when the token is
 * missing, malformed, or has no numeric exp claim.  Mirrors the previous
 * inline behaviour of GET to keep the public response shape stable.
 */
function decodeJwtExp(idToken: string | undefined): number {
  if (!idToken) return 0;
  const parts = idToken.split(".");
  if (parts.length !== 3) return 0;
  try {
    const payload = JSON.parse(
      Buffer.from(parts[1].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"),
    ) as { exp?: unknown };
    return typeof payload.exp === "number" ? payload.exp : 0;
  } catch {
    return 0;
  }
}

/**
 * Public response shape for /api/auth/session.  Intentionally excludes
 * idToken / refreshToken so httpOnly cookies cannot leak via this JSON.
 */
export interface SessionJson {
  sub: string;
  exp: number;
  owner_id: string | null;
}

/**
 * Pure helper that constructs the SessionJson payload from the cookies
 * already fetched and the owner_id resolved via the daemon bridge.  Kept
 * separate from `GET` so the response shape can be asserted without a
 * Next.js request context.
 */
export function buildSessionJson(args: {
  sub: string;
  idToken: string | undefined;
  ownerId: string | null;
}): SessionJson {
  return {
    sub: args.sub,
    exp: decodeJwtExp(args.idToken),
    owner_id: args.ownerId,
  };
}

// Local-dev bypass: when E2E_BYPASS_AUTH=1, mint a synthetic session so the
// dashboard renders without going through Cognito.  Mirrors the constant in
// src/app/api/proxy/[...path]/route.ts so /api/auth/session and the proxy
// agree on the dev actor.
const DEV_ACTOR_SUBJECT_ID = "00000000-0000-0000-0000-000000000001";

export async function GET() {
  // Local-dev / CI bypass: skip Cognito entirely.
  if (process.env.E2E_BYPASS_AUTH === "1") {
    return NextResponse.json(
      buildSessionJson({
        sub: "dev-bypass",
        idToken: undefined,
        ownerId: DEV_ACTOR_SUBJECT_ID,
      }),
    );
  }

  const jar = await cookies();
  const idToken = jar.get(COOKIE_ID_TOKEN)?.value;
  // refreshToken is read from the cookie for parity / future use but MUST
  // NEVER be returned to the browser.  See `SessionJson` above.
  void jar.get(COOKIE_REFRESH_TOKEN)?.value;
  const sub = await resolveAuthenticatedUserSub({ cookieStore: jar });
  if (!sub) {
    return NextResponse.json({ error: "not authenticated" }, { status: 401 });
  }
  const ownerId = await resolveOwnerId(sub);
  return NextResponse.json(buildSessionJson({ sub, idToken, ownerId }));
}

import { type NextRequest, NextResponse } from "next/server";

import { getClient, intersectScopes } from "@/shared/auth/cli/clients";
import { validateLoopbackRedirect } from "@/shared/auth/cli/redirect-uri";
import {
  insertPendingConsent,
} from "@/shared/auth/cli/pending-consent-store";
import { resolveAuthenticatedUserSub } from "@/shared/auth/authenticated-session";
import { getPublicOrigin } from "@/shared/auth/public-origin";
import { safeNextPath } from "@/shared/auth/safe-next-path";

// /cli/authorize — GET (Issue #153, plan D6).
//
// Splits into a Route Handler (protocol validation + DB-backed pending
// consent insert + 302 to /cli/consent) and a Server Component (the
// consent UI). The pending consent row captures both the original params
// AND the user_sub resolved from BetterAuth; the POST handler later
// re-checks the user_sub, eliminating a class of bugs around session
// swap between GET and POST (no HMAC key needed — D6.2).
//
// Production-only invariant (plan D8): when `E2E_BYPASS_AUTH=1` is set
// these endpoints MUST NOT short-circuit to success. The CLI's mock
// integration test (`tastile-cli/crates/tastile-auth/tests/auth_flow.rs`)
// only ever sets `E2E_BYPASS_AUTH=0`. We reject the bypass explicitly so a
// misconfigured production-like environment cannot mint a real token via
// the dev bypass.

const PENDING_CONSENT_TTL_SECONDS = 300; // 5 minutes (matches plan D1)

function badRequest(reason: string): NextResponse {
  // Deliberate non-leakage: the error message names the validation failure
  // but never the offending value, and never the registered client set.
  return NextResponse.json({ error: reason }, { status: 400 });
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (process.env.E2E_BYPASS_AUTH === "1") {
    // Production safety: refuse to even parse, so the dev bypass cannot be
    // repurposed as a token-mint primitive.
    return NextResponse.json(
      { error: "bypass_not_permitted" },
      { status: 400 },
    );
  }

  const url = new URL(request.url);
  const params = url.searchParams;

  // Strict 7-param shape; extras rejected.
  const expectedKeys = [
    "response_type",
    "client_id",
    "redirect_uri",
    "scope",
    "state",
    "code_challenge",
    "code_challenge_method",
  ];
  const present = [...params.keys()].filter((k) => params.has(k));
  const unexpected = present.filter((k) => !expectedKeys.includes(k));
  if (unexpected.length > 0) {
    return badRequest("invalid_request");
  }
  for (const key of expectedKeys) {
    if (!params.has(key)) return badRequest("invalid_request");
  }

  const responseType = params.get("response_type") ?? "";
  const clientId = params.get("client_id") ?? "";
  const redirectUri = params.get("redirect_uri") ?? "";
  const scope = params.get("scope") ?? "";
  const state = params.get("state") ?? "";
  const codeChallenge = params.get("code_challenge") ?? "";
  const codeChallengeMethod = params.get("code_challenge_method") ?? "";

  if (responseType !== "code") return badRequest("invalid_request");
  if (codeChallengeMethod !== "S256") return badRequest("invalid_request");

  const client = getClient(clientId);
  if (!client) {
    // Do NOT leak which clients are registered.
    return badRequest("invalid_client");
  }

  const redirect = validateLoopbackRedirect(redirectUri);
  if (!redirect.ok) {
    return badRequest("invalid_redirect_uri");
  }

  const effectiveScopes = intersectScopes(scope, client.scopes);
  if (effectiveScopes.length === 0) {
    return badRequest("invalid_scope");
  }

  const userSub = await resolveAuthenticatedUserSub();
  if (!userSub) {
    // Send the user to login with the original /cli/authorize URL as the
    // continuation target. Same path-safety as /api/auth/bridge.
    const originalPath = `/cli/authorize?${params.toString()}`;
    const next = safeNextPath(originalPath) ?? "/cli/authorize";
    const target = new URL("/login", getPublicOrigin());
    target.searchParams.set("next", next);
    return NextResponse.redirect(target);
  }

  const tid = await insertPendingConsent({
    userSub,
    clientId,
    codeChallenge,
    redirectUri,
    scopesRequested: scope,
    scopesEffective: effectiveScopes.join(" "),
    state,
    responseType,
    ttlSeconds: PENDING_CONSENT_TTL_SECONDS,
  });

  const consentUrl = new URL("/cli/consent", getPublicOrigin());
  consentUrl.searchParams.set("tid", tid);
  return NextResponse.redirect(consentUrl);
}

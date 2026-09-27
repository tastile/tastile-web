import { type NextRequest, NextResponse } from "next/server";

import { getClient } from "@/shared/auth/cli/clients";
import {
  consumeGrantOnce,
  markCoreTokenId,
} from "@/shared/auth/cli/grant-store";
import { cliTokenExpiresAtIso, mintTastileApiTokenForUser } from "@/shared/auth/cli/core-mint";
import { hashGrantCode, s256 } from "@/shared/auth/cli/pkce";

// /api/cli/token — POST (Issue #153, plan D7).
//
// Wire contract (mirrors tastile-cli/crates/tastile-auth/tests/auth_flow.rs):
//   body: { "code", "code_verifier", "redirect_uri" }   (exactly 3 keys)
//   no Cookie header
//   → 200 { "token", "expires_at", "subject" }
//   → 4xx { "error", "detail" }   (400 / 409 / 410)
//
// The handler is **public** — it does NOT read the BetterAuth session.
// The session-resolved user is bound to the grant row at /cli/authorize
// time and the atomic UPDATE returns it as the row's user_sub.
//
// Production-only invariant (plan D8): `E2E_BYPASS_AUTH=1` MUST NOT be
// treated as success; the handler rejects the request explicitly so the
// dev bypass cannot be repurposed as a token-mint primitive.

type TokenBody =
  | {
      code: unknown;
      code_verifier: unknown;
      redirect_uri: unknown;
      [key: string]: unknown;
    };

function jsonError(
  status: number,
  error: string,
  detail?: string,
): NextResponse {
  const body: Record<string, unknown> = { error };
  if (detail) body.detail = detail;
  return NextResponse.json(body, { status });
}

function badRequest(
  error: string,
  detail?: string,
): NextResponse {
  return jsonError(400, error, detail);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (process.env.E2E_BYPASS_AUTH === "1") {
    return badRequest("bypass_not_permitted");
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return badRequest("invalid_content_type");
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return badRequest("invalid_json");
  }
  if (!rawBody || typeof rawBody !== "object" || Array.isArray(rawBody)) {
    return badRequest("invalid_body");
  }
  const body = rawBody as TokenBody;

  const expectedKeys = ["code", "code_verifier", "redirect_uri"];
  const present = Object.keys(body);
  if (present.some((k) => !expectedKeys.includes(k))) {
    // Extra fields (e.g. client_id / client_secret) are explicitly rejected
    // by the wire contract — they are not part of the public-client model.
    return badRequest("invalid_body");
  }
  for (const key of expectedKeys) {
    if (!(key in body)) return badRequest("invalid_body");
  }
  if (
    typeof body.code !== "string" ||
    typeof body.code_verifier !== "string" ||
    typeof body.redirect_uri !== "string"
  ) {
    return badRequest("invalid_body");
  }

  // Pre-compute the expected challenge so the atomic UPDATE can compare it
  // server-side (no extra round-trip to derive it inside SQL).
  const expectedChallenge = s256(body.code_verifier);

  const consumed = await consumeGrantOnce({
    code: body.code,
    codeChallenge: expectedChallenge,
    redirectUri: body.redirect_uri,
  });

  if (consumed.status !== "ok") {
    switch (consumed.status) {
      case "invalid_grant":
        return badRequest("invalid_grant");
      case "already_used":
        // CLI test fixture at auth_flow.rs:602 asserts the message
        // contains the phrase "already used".
        return jsonError(409, "already_used", "authorization code already used");
      case "gone":
        return jsonError(410, "gone", "authorization code expired");
      case "pkce_mismatch":
        return badRequest("invalid_grant");
      case "redirect_uri_mismatch":
        return badRequest("redirect_uri_mismatch");
    }
  }

  // Post-check: clientId must still be in the registered set. If a client
  // was removed between /cli/authorize and the exchange, the grant is
  // already consumed but we must not mint a token against an unknown
  // client_id.
  const client = getClient(consumed.clientId);
  if (!client) {
    return badRequest("invalid_grant");
  }

  const expiresAtIso = cliTokenExpiresAtIso();
  const minted = await mintTastileApiTokenForUser({
    userSub: consumed.userSub,
    label: "tastile-cli",
    scopes: consumed.scopesEffective,
    expiresAtIso,
  });

  if (!minted) {
    // Core mint failed (502 from Core or bridge secret missing). The grant
    // is already consumed at this point; the CLI must re-authorize. Log
    // the failure WITHOUT the plaintext code / verifier / bearer token.
    console.warn(
      "[cli-auth] core mint failed for user_sub=%s; grant consumed",
      consumed.userSub,
    );
    return jsonError(502, "core_unavailable");
  }

  // Second UPDATE: persist the core_token_id for audit / revocation flows.
  await markCoreTokenId(hashGrantCode(body.code), minted.token.slice(0, 32));

  return NextResponse.json({
    token: minted.token,
    expires_at: minted.expiresAt,
    subject: minted.subject,
  });
}

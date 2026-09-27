import { type NextRequest, NextResponse } from "next/server";

import { getClient } from "@/shared/auth/cli/clients";
import { insertGrant } from "@/shared/auth/cli/grant-store";
import { generateGrantCode } from "@/shared/auth/cli/pkce";
import {
  loadPendingConsent,
  markPendingConsumed,
} from "@/shared/auth/cli/pending-consent-store";
import { resolveAuthenticatedUserSub } from "@/shared/auth/authenticated-session";

// /cli/consent — POST (Issue #153, plan D6).
//
// Re-resolves the BetterAuth session (defense against session swap between
// GET /cli/authorize and this POST), verifies the row's user_sub matches
// the session, atomically marks the pending row consumed (replay defense),
// then either mints a grant (allow) or redirects with `error=access_denied`
// (deny). The grant code is generated fresh and only its sha256 is stored
// (D1).
//
// Production-only invariant (plan D8): `E2E_BYPASS_AUTH=1` MUST NOT be
// treated as a successful authorization. The handler returns 400 the same
// way the GET handler does.

const GRANT_TTL_SECONDS = 300; // 5 minutes (matches plan D1)

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (process.env.E2E_BYPASS_AUTH === "1") {
    return NextResponse.json(
      { error: "bypass_not_permitted" },
      { status: 400 },
    );
  }

  const form = await request.formData().catch(() => null);
  if (!form) {
    return NextResponse.json({ error: "invalid_form" }, { status: 400 });
  }
  const tid = form.get("tid");
  const decision = form.get("decision");
  if (typeof tid !== "string" || tid.length === 0) {
    return NextResponse.json({ error: "missing_tid" }, { status: 400 });
  }
  if (decision !== "allow" && decision !== "deny") {
    return NextResponse.json({ error: "invalid_decision" }, { status: 400 });
  }

  const userSub = await resolveAuthenticatedUserSub();
  if (!userSub) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const pending = await loadPendingConsent(tid);
  if (pending.status !== "ok") {
    // missing / expired / consumed all collapse to 410; the user is told
    // to re-authorize via the CLI.
    return NextResponse.json({ error: pending.status }, { status: 410 });
  }
  if (pending.userSub !== userSub) {
    // Session swap / cross-account attempt: refuse with 403.
    console.warn("[cli-auth] user mismatch on consent POST");
    return NextResponse.json({ error: "user_mismatch" }, { status: 403 });
  }

  const consumed = await markPendingConsumed(tid);
  if (!consumed) {
    // Another POST (replay) consumed the row first.
    return NextResponse.json({ error: "already_consumed" }, { status: 410 });
  }

  // Re-validate the registered client set in case the client was removed
  // between authorize and consent. (Plan D5 — registered set is the
  // authority for which scopes can flow through.)
  const client = getClient(pending.clientId);
  if (!client) {
    return NextResponse.json({ error: "invalid_client" }, { status: 400 });
  }

  const target = new URL(pending.redirectUri);
  if (decision === "deny") {
    target.searchParams.set("error", "access_denied");
    if (pending.state) target.searchParams.set("state", pending.state);
    return NextResponse.redirect(target);
  }

  // decision === "allow"
  const code = generateGrantCode();
  await insertGrant({
    code,
    clientId: pending.clientId,
    userSub: pending.userSub,
    codeChallenge: pending.codeChallenge,
    redirectUri: pending.redirectUri,
    scopesRequested: pending.scopesEffective,
    scopesEffective: pending.scopesEffective,
    ttlSeconds: GRANT_TTL_SECONDS,
  });

  target.searchParams.set("code", code);
  if (pending.state) target.searchParams.set("state", pending.state);
  return NextResponse.redirect(target);
}

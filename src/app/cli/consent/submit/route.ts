import { type NextRequest, NextResponse } from "next/server";

import { getClient } from "@/shared/auth/cli/clients";
import { insertGrant } from "@/shared/auth/cli/grant-store";
import { generateGrantCode } from "@/shared/auth/cli/pkce";
import {
  atomicConsumePendingConsent,
} from "@/shared/auth/cli/pending-consent-store";
import { resolveAuthenticatedUserSub } from "@/shared/auth/authenticated-session";

// POST /cli/consent/submit — Issue #153, plan D6.
//
// The POST handler lives at a distinct URL from GET /cli/consent (the
// Server Component that renders the consent UI). Next.js App Router forbids
// `page.tsx` and `route.ts` from sharing the same segment, so the form
// action points here instead of at `/cli/consent`. UI rendering is
// unchanged; only the submit URL moved.
//
// Re-resolves the BetterAuth session (defense against session swap between
// GET /cli/authorize and this POST), atomically marks the pending row
// consumed (replay defense + user_mismatch check in one statement, plan
// D6.1) and either mints a grant (allow) or redirects with
// `error=access_denied` (deny). The grant code is generated fresh and only
// its sha256 is stored (D1).
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

  // Atomic UPDATE: rowCount === 0 ⇒ classify via follow-up SELECT. The
  // TOCTOU window between a separate SELECT and a separate UPDATE is gone,
  // so an expired row consumed mid-handshake cannot win the UPDATE and
  // emit a grant.
  const consumed = await atomicConsumePendingConsent(tid, userSub);
  switch (consumed.status) {
    case "missing":
    case "consumed":
    case "expired":
      return NextResponse.json({ error: consumed.status }, { status: 410 });
    case "user_mismatch":
      console.warn("[cli-auth] user mismatch on consent POST");
      return NextResponse.json({ error: "user_mismatch" }, { status: 403 });
    case "ok":
      break;
  }

  // Re-validate the registered client set in case the client was removed
  // between authorize and consent. (Plan D5 — registered set is the
  // authority for which scopes can flow through.)
  const client = getClient(consumed.clientId);
  if (!client) {
    return NextResponse.json({ error: "invalid_client" }, { status: 400 });
  }

  const target = new URL(consumed.redirectUri);
  if (decision === "deny") {
    target.searchParams.set("error", "access_denied");
    if (consumed.state) target.searchParams.set("state", consumed.state);
    return NextResponse.redirect(target);
  }

  // decision === "allow"
  const code = generateGrantCode();
  await insertGrant({
    code,
    clientId: consumed.clientId,
    userSub: consumed.userSub,
    codeChallenge: consumed.codeChallenge,
    redirectUri: consumed.redirectUri,
    scopesRequested: consumed.scopesEffective,
    scopesEffective: consumed.scopesEffective,
    ttlSeconds: GRANT_TTL_SECONDS,
  });

  target.searchParams.set("code", code);
  if (consumed.state) target.searchParams.set("state", consumed.state);
  return NextResponse.redirect(target);
}
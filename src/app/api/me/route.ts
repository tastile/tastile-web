import { NextResponse } from "next/server";

import { getCoreClient } from "@/lib/api/endpoints";
import { getAccountIdTokenClaims, getAccountOwnerId } from "@/lib/cognito/account-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface OwnerProfileView {
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  accent_color: string | null;
  revision: number;
}

export async function GET(): Promise<Response> {
  const ownerId = await getAccountOwnerId();
  if (!ownerId) {
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }

  const claims = await getAccountIdTokenClaims();
  const profileRes = await getCoreClient().call<OwnerProfileView>("getOwnerProfile", {
    pathParams: { kind: "0", id: ownerId },
  });
  if (!profileRes.ok) {
    // Don't leak the upstream status code verbatim; the BFF's contract
    // is "logged-in user can see their profile" so any failure maps to
    // 502 (we couldn't read from the source of truth).
    return NextResponse.json({ error: "UPSTREAM_FAILURE" }, { status: 502 });
  }

  return NextResponse.json({
    owner_id: ownerId,
    email: claims?.email ?? null,
    email_verified: claims?.emailVerified ?? false,
    display_name: profileRes.data.display_name,
    avatar_url: profileRes.data.avatar_url,
    bio: profileRes.data.bio,
    accent_color: profileRes.data.accent_color,
    revision: profileRes.data.revision,
  });
}

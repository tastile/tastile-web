import { NextResponse } from "next/server";

import { getCoreClient } from "@/shared/api/endpoints";
import { getAccountOwnerId } from "@/shared/auth/account-session";
import { resolveAuthenticatedSession } from "@/shared/auth/authenticated-session";

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
  // Local-dev / CI bypass: synthesize the same shape the real handler returns
  // for a freshly-signed-up owner (all profile fields null, revision 0) so
  // the dashboard header renders without a round-trip through the local
  // daemon.  Mirrors `getAccountOwnerId`'s E2E shortcut.
  if (process.env.E2E_BYPASS_AUTH === "1") {
    const ownerId = await getAccountOwnerId();
    if (!ownerId) {
      return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
    }
    return NextResponse.json({
      owner_id: ownerId,
      email: null,
      email_verified: false,
      display_name: null,
      avatar_url: null,
      bio: null,
      accent_color: null,
      revision: 0,
    });
  }

  const ownerId = await getAccountOwnerId();
  if (!ownerId) {
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }

  const [sessionUser, profileRes] = await Promise.all([
    resolveAuthenticatedSession(),
    getCoreClient().call<OwnerProfileView>("getOwnerProfile", {
      pathParams: { kind: "0", id: ownerId },
    }),
  ]);
  if (!profileRes.ok) {
    const upstreamStatus = profileRes.error.status;
    // Upstream auth failure → our session is bad; force re-login
    if (upstreamStatus === 401 || upstreamStatus === 403) {
      return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
    }
    // Profile row missing for a freshly-signed-up owner is normal;
    // return 200 with nulls so the client can render the empty state.
    if (upstreamStatus === 404) {
      return NextResponse.json({
        owner_id: ownerId,
        email: sessionUser?.email ?? null,
        email_verified: sessionUser?.emailVerified ?? false,
        display_name: null,
        avatar_url: null,
        bio: null,
        accent_color: null,
        revision: 0,
      });
    }
    // 5xx or anything else from the source of truth
    return NextResponse.json({ error: "UPSTREAM_FAILURE" }, { status: 502 });
  }

  return NextResponse.json({
    owner_id: ownerId,
    email: sessionUser?.email ?? null,
    email_verified: sessionUser?.emailVerified ?? false,
    display_name: profileRes.data.display_name,
    avatar_url: profileRes.data.avatar_url,
    bio: profileRes.data.bio,
    accent_color: profileRes.data.accent_color,
    revision: profileRes.data.revision,
  });
}

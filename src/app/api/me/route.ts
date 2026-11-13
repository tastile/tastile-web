import { NextResponse } from "next/server";

import { upstreamGetOwnerProfile } from "@/lib/upstream/events";
import { getAccountOwnerId } from "@/shared/auth/account-session";
import { resolveAuthenticatedSession } from "@/shared/auth/authenticated-session";
import { isE2EBypassEnabled } from "@/shared/config/runtime-env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// OwnerKind.USER (v1/15): a signed-in user's own profile.
const USER_OWNER_KIND = 0;

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
  if (isE2EBypassEnabled()) {
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
    upstreamGetOwnerProfile(USER_OWNER_KIND, ownerId),
  ]);
  if (!profileRes) {
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }
  if (profileRes.status < 200 || profileRes.status >= 300) {
    const upstreamStatus = profileRes.status;
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
  const profile = profileRes.body as OwnerProfileView;

  return NextResponse.json({
    owner_id: ownerId,
    email: sessionUser?.email ?? null,
    email_verified: sessionUser?.emailVerified ?? false,
    display_name: profile.display_name,
    avatar_url: profile.avatar_url,
    bio: profile.bio,
    accent_color: profile.accent_color,
    revision: profile.revision,
  });
}

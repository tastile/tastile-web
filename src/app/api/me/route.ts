import { type NextRequest, NextResponse } from "next/server";

import { getAccountOwnerId } from "@/shared/auth/account-session";
import { resolveAuthenticatedSession } from "@/shared/auth/authenticated-session";
import { isE2EBypassEnabled } from "@/shared/config/runtime-env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface OwnerProfileView {
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  accent_color: string | null;
  revision: number;
}

export async function GET(request: NextRequest): Promise<Response> {
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

  const sessionUser = await resolveAuthenticatedSession();
  // Route handlers cannot use the browser CoreClient: its proxy base URL is
  // relative and its direct mode carries no server-side credentials.  Go
  // through this app's own /api/proxy so the session cookies authenticate
  // the upstream call exactly like a browser request would (web#209).
  let profileStatus: number;
  let profileData: OwnerProfileView | null = null;
  try {
    const upstream = await fetch(
      `${request.nextUrl.origin}/api/proxy/v1/owners/0/${ownerId}/profile`,
      {
        headers: { cookie: request.headers.get("cookie") ?? "" },
        cache: "no-store",
      },
    );
    profileStatus = upstream.status;
    if (upstream.ok) {
      profileData = (await upstream.json()) as OwnerProfileView;
    }
  } catch {
    return NextResponse.json({ error: "UPSTREAM_FAILURE" }, { status: 502 });
  }
  const profileRes =
    profileData !== null
      ? { ok: true as const, data: profileData }
      : { ok: false as const, status: profileStatus };
  if (!profileRes.ok) {
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

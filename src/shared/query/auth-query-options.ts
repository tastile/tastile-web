"use client";

import { pickDisplayLabel } from "@/shared/auth/display-label";

export interface SafeSession {
  sub: string;
  exp: number;
  owner_id: string | null;
}

export interface ProfileMe {
  email: string | null;
  displayName: string | null;
  avatarUrl: string | null;
}

async function fetchSafeSession(): Promise<SafeSession | null> {
  const res = await fetch("/api/auth/session", { cache: "no-store" });
  if (!res.ok) return null;
  const data = (await res.json()) as Partial<SafeSession>;
  if (typeof data.sub !== "string") return null;
  return {
    sub: data.sub,
    exp: typeof data.exp === "number" ? data.exp : 0,
    owner_id: typeof data.owner_id === "string" ? data.owner_id : null,
  };
}

async function fetchProfile(): Promise<ProfileMe | null> {
  const res = await fetch("/api/me", { cache: "no-store" });
  if (!res.ok) return null;
  const data = (await res.json()) as {
    email?: string | null;
    display_name?: string | null;
    avatar_url?: string | null;
  };
  return {
    email: typeof data.email === "string" ? data.email : null,
    displayName: typeof data.display_name === "string" ? data.display_name : null,
    avatarUrl: typeof data.avatar_url === "string" ? data.avatar_url : null,
  };
}

const authQueryKeys = {
  session: ["auth", "safe-session"] as const,
  profile: ["auth", "profile"] as const,
} as const;

export const safeSessionQueryOptions = {
  queryKey: authQueryKeys.session,
  queryFn: fetchSafeSession,
  retry: false,
  staleTime: 60_000,
};

export const profileQueryOptions = {
  queryKey: authQueryKeys.profile,
  queryFn: fetchProfile,
  retry: false,
  staleTime: 60_000,
};

export function sessionToAuthValue(
  session: SafeSession | null | undefined,
  profile: ProfileMe | null | undefined,
) {
  if (!session) return null;
  return {
    sub: session.sub,
    ownerId: session.owner_id,
    email: profile?.email ?? null,
    displayName: pickDisplayLabel({
      displayName: profile?.displayName ?? null,
      email: profile?.email ?? null,
      ownerId: session.owner_id,
      sub: session.sub,
    }),
    avatarUrl: profile?.avatarUrl ?? null,
  };
}

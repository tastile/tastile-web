"use client";

import { useAuth } from "@/shared/context/auth-context";

export function useCurrentActorSubjectId(): string | null {
  const { session } = useAuth();
  return session?.ownerId ?? null;
}

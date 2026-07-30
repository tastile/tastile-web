"use client";

import { useQuery } from "@tanstack/react-query";

// Placeholder UUID used in E2E bypass mode. The v1 backend auto-creates
// a USER-kind v1_subject row with this id on first workspace creation,
// so it doubles as the actor's own subject id for "Personal" ownership.
const DEV_ACTOR_SUBJECT_ID = "00000000-0000-0000-0000-000000000001";

interface SessionResponse {
  owner_id?: string;
  authenticated?: boolean;
}

async function fetchActorId(): Promise<string | null> {
  if (process.env.NEXT_PUBLIC_E2E_BYPASS_AUTH === "1") return DEV_ACTOR_SUBJECT_ID;
  const res = await fetch("/api/auth/session", { cache: "no-store" });
  if (!res.ok) return null;
  const data = (await res.json()) as SessionResponse;
  return data?.owner_id ?? null;
}

/**
 * Resolve the current actor's v1_subject id (kind=0 USER).
 *
 * In E2E bypass mode the proxy pins every request to the dev placeholder
 * UUID, so we hard-code it here to keep the client in sync. In a real
 * Cognito session this will be derived from /api/auth/session once the
 * backend returns the resolved USER subject id instead of the raw JWT
 * sub.
 */
export function useCurrentActorSubjectId(): string | null {
  const isE2E = process.env.NEXT_PUBLIC_E2E_BYPASS_AUTH === "1";
  const { data } = useQuery({
    queryKey: ["current-actor"],
    queryFn: fetchActorId,
    enabled: !isE2E,
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: Number.POSITIVE_INFINITY,
  });
  return isE2E ? DEV_ACTOR_SUBJECT_ID : (data ?? null);
}

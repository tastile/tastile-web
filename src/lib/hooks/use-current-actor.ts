"use client";

import { useEffect, useState } from "react";

// Placeholder UUID used in E2E bypass mode. The v1 backend auto-creates
// a USER-kind v1_subject row with this id on first workspace creation,
// so it doubles as the actor's own subject id for "Personal" ownership.
const DEV_ACTOR_SUBJECT_ID = "00000000-0000-0000-0000-000000000001";

interface SessionResponse {
  owner_id?: string;
  authenticated?: boolean;
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
  const [actorId, setActorId] = useState<string | null>(
    process.env.NEXT_PUBLIC_E2E_BYPASS_AUTH === "1" ? DEV_ACTOR_SUBJECT_ID : null,
  );

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_E2E_BYPASS_AUTH === "1") {
      setActorId(DEV_ACTOR_SUBJECT_ID);
      return;
    }
    let alive = true;
    fetch("/api/auth/session", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: SessionResponse | null) => {
        if (!alive) return;
        if (data?.owner_id) setActorId(data.owner_id);
      })
      .catch(() => {
        /* keep prior value; the create command can still surface the auth error */
      });
    return () => {
      alive = false;
    };
  }, []);

  return actorId;
}

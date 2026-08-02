/**
 * usePendingSessions — TanStack Query wrapper for the open-session list.
 *
 * Polls `GET /v1/sessions?status=open` every 15s while mounted. The hook
 * is intentionally narrow; the `DecisionPromptSheet` (Task 7) consumes
 * the result and is the only consumer in this codebase.
 */

import { type SessionView, listPendingSessions } from "@/shared/api/v1/sessions";
import { makeClient } from "@/shared/api/v1/submit";
import { useQuery } from "@tanstack/react-query";

export function usePendingSessions() {
  return useQuery<SessionView[]>({
    queryKey: ["v1", "sessions", "pending"],
    queryFn: async () => {
      const client = makeClient();
      const result = await listPendingSessions(client);
      if (!result.ok) {
        throw new Error(`listPendingSessions failed: ${result.error.kind} ${result.error.message}`);
      }
      return result.data;
    },
    refetchInterval: 15_000,
    staleTime: 10_000,
  });
}

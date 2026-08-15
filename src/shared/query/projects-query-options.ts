"use client";

import { getCoreClient } from "@/shared/api/endpoints";
import type { Workspace } from "@/shared/hooks/use-workspaces";
import { queryKeys } from "./query-keys";

const projectsQueryKey = [...queryKeys.projects] as const;

async function fetchWorkspaces(): Promise<Workspace[]> {
  // v1/15 §6 #15: surface the caller's USER subject as the implicit personal
  // scope (kind=0, always at index 0) followed by owned WORKSPACEs (kind=1).
  // Server-side ordering is pinned by list_subjects_handler (USER first, then
  // list_workspaces_for_owner ORDER BY created_at ASC). We do NOT re-sort on
  // the client because the USER row's display_name is intentionally empty.
  const res = await getCoreClient().call<{ items: Workspace[]; count: number }>("listMySubjects");
  if (!res.ok) throw new Error(res.error.message);
  return res.data.items ?? [];
}

export const projectsQueryOptions = {
  queryKey: projectsQueryKey,
  queryFn: fetchWorkspaces,
};

"use client";

import { getCoreClient } from "@/shared/api/endpoints";
import type { Workspace } from "@/shared/hooks/use-workspaces";
import { queryKeys } from "./query-keys";

const projectsQueryKey = [...queryKeys.projects] as const;

async function fetchWorkspaces(): Promise<Workspace[]> {
  const res = await getCoreClient().call<{ items: Workspace[]; count: number }>("listMyWorkspaces");
  if (!res.ok) throw new Error(res.error.message);
  return res.data.items ?? [];
}

export const projectsQueryOptions = {
  queryKey: projectsQueryKey,
  queryFn: fetchWorkspaces,
};

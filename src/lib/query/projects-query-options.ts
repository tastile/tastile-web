"use client";

import { getCoreClient } from "@/lib/api/endpoints";
import type { Workspace } from "@/lib/hooks/use-projects";
import { queryKeys } from "./query-keys";

export const projectsQueryKey = [...queryKeys.projects] as const;

export async function fetchWorkspaces(): Promise<Workspace[]> {
  const res = await getCoreClient().call<{ items: Workspace[]; count: number }>("listMyWorkspaces");
  if (!res.ok) throw new Error(res.error.message);
  return res.data.items ?? [];
}

export const projectsQueryOptions = {
  queryKey: projectsQueryKey,
  queryFn: fetchWorkspaces,
};

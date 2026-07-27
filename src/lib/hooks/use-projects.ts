"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { getCoreClient } from "@/lib/api/endpoints";
import { projectsQueryOptions, projectsQueryKey } from "@/lib/query/projects-query-options";

export interface Workspace {
  id: string; kind: number; display_name: string; slug: string | null; email: string | null;
  parent_subject_id: string | null; color: string | null; owner_user_id: string | null;
  disabled_at: string | null; created_at: string; updated_at: string;
}
interface UseProjectsState { workspaces: Workspace[]; loading: boolean; error: Error | null; refresh: () => Promise<void>; }

export function useProjects(): UseProjectsState {
  const query = useQuery(projectsQueryOptions);
  return { workspaces: query.data ?? [], loading: query.isPending, error: query.error as Error | null, refresh: async () => { await query.refetch(); } };
}

export interface CreateWorkspaceInput { display_name: string; slug?: string | null; color?: string | null; parent_subject_id?: string | null; }
async function createWorkspaceRequest(input: CreateWorkspaceInput): Promise<Workspace> {
  const res = await getCoreClient().call<Workspace>("createWorkspace", { body: { display_name: input.display_name, slug: input.slug ?? null, color: input.color ?? null, parent_subject_id: input.parent_subject_id ?? null } });
  if (!res.ok) throw new Error(res.error.message); return res.data;
}
export async function createWorkspace(input: CreateWorkspaceInput): Promise<Workspace> { return createWorkspaceRequest(input); }

export interface WorkspaceTreeEntry { workspace: Workspace; depth: number; }
export function orderWorkspaceTree(workspaces: Workspace[]): WorkspaceTreeEntry[] {
  const byParent = new Map<string | null, Workspace[]>(); const ids = new Set(workspaces.map((w) => w.id));
  for (const workspace of workspaces) { const parent = workspace.parent_subject_id && ids.has(workspace.parent_subject_id) ? workspace.parent_subject_id : null; const children = byParent.get(parent) ?? []; children.push(workspace); byParent.set(parent, children); }
  for (const children of byParent.values()) children.sort((a, b) => a.display_name.localeCompare(b.display_name, "ja"));
  const result: WorkspaceTreeEntry[] = []; const visit = (parent: string | null, depth: number) => { for (const workspace of byParent.get(parent) ?? []) { result.push({ workspace, depth }); visit(workspace.id, depth + 1); } }; visit(null, 0); return result;
}
export interface UpdateWorkspaceInput { display_name?: string; slug?: string | null; color?: string | null; }
export async function updateWorkspace(id: string, input: UpdateWorkspaceInput): Promise<Workspace> { const res = await getCoreClient().call<Workspace>("updateSubject", { pathParams: { id }, body: { display_name: input.display_name, slug: input.slug === undefined ? undefined : input.slug, color: input.color === undefined ? undefined : input.color } }); if (!res.ok) throw new Error(res.error.message); return res.data; }
export async function deleteWorkspace(id: string): Promise<void> { const res = await getCoreClient().call<{ ok: true }>("deleteSubject", { pathParams: { id } }); if (!res.ok) throw new Error(res.error.message); }

export function useWorkspaceMutations() {
  const client = useQueryClient();
  const invalidate = () => client.invalidateQueries({ queryKey: projectsQueryKey });
  return {
    create: useMutation({ mutationFn: createWorkspaceRequest, onSuccess: invalidate }),
    update: useMutation({ mutationFn: ({ id, input }: { id: string; input: UpdateWorkspaceInput }) => updateWorkspace(id, input), onSuccess: invalidate }),
    remove: useMutation({ mutationFn: deleteWorkspace, onSuccess: invalidate }),
  };
}

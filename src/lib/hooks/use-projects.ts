"use client";

import { useCallback, useEffect, useState } from "react";
import { getCoreClient } from "@/lib/api/endpoints";

export interface Workspace {
  id: string;
  kind: number;
  display_name: string;
  slug: string | null;
  email: string | null;
  color: string | null;
  owner_user_id: string | null;
  disabled_at: string | null;
  created_at: string;
  updated_at: string;
}

interface UseProjectsState {
  workspaces: Workspace[];
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

export function useProjects(): UseProjectsState {
  const [state, setState] = useState<Omit<UseProjectsState, "refresh">>({
    workspaces: [],
    loading: true,
    error: null,
  });

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    const res = await getCoreClient().call<{ items: Workspace[]; count: number }>(
      "listMyWorkspaces",
    );
    if (res.ok) {
      setState({ workspaces: res.data.items ?? [], loading: false, error: null });
    } else {
      setState({ workspaces: [], loading: false, error: new Error(res.error.message) });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { ...state, refresh: load };
}

export interface CreateWorkspaceInput {
  display_name: string;
  slug?: string | null;
  color?: string | null;
}

export async function createWorkspace(input: CreateWorkspaceInput): Promise<Workspace> {
  const res = await getCoreClient().call<Workspace>("createWorkspace", {
    body: {
      display_name: input.display_name,
      slug: input.slug ?? null,
      color: input.color ?? null,
    },
  });
  if (!res.ok) throw new Error(res.error.message);
  return res.data;
}

export interface UpdateWorkspaceInput {
  display_name?: string;
  slug?: string | null;
  color?: string | null;
}

export async function updateWorkspace(id: string, input: UpdateWorkspaceInput): Promise<Workspace> {
  const res = await getCoreClient().call<Workspace>("updateSubject", {
    pathParams: { id },
    body: {
      display_name: input.display_name,
      slug: input.slug === undefined ? undefined : input.slug,
      color: input.color === undefined ? undefined : input.color,
    },
  });
  if (!res.ok) throw new Error(res.error.message);
  return res.data;
}

export async function deleteWorkspace(id: string): Promise<void> {
  const res = await getCoreClient().call<{ ok: true }>("deleteSubject", {
    pathParams: { id },
  });
  if (!res.ok) throw new Error(res.error.message);
}

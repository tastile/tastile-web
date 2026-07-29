"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { getCoreClient } from "@/lib/api/endpoints";
import type { SourceTileSummaryWire } from "@/lib/api/v1/source-tiles";
import { queryKeys } from "@/lib/query/query-keys";

export interface TileListView {
  id: string;
  plan_id: string | null;
  title: string;
  lifecycle: number;
  next_action: string | null;
  done_definition: string | null;
  worked_minutes: number;
  break_minutes: number;
  labels: string[];
  objective_mode: number;
  target_work_min: number | null;
  target_rest_min: number | null;
  done_rule: number | null;
  resume_note: string | null;
  projected_next_start_at: string | null;
  temporal: {
    release_at: string | null;
    due_at: string | null;
    fixed_start: string | null;
    fixed_end: string | null;
    active_start: string | null;
    active_end: string | null;
  } | null;
  recurrence: {
    step_min: number;
    window_start_min: number;
    window_end_min: number;
    expression: string | null;
  } | null;
  source: SourceTileSummaryWire | null;
}
export interface UseTileListArgs {
  viewMode?: string;
  lifecycle?: string;
  limit?: number;
  search?: string;
  excludeFuture?: boolean;
  range?: string;
  granularity?: string;
  ownerIds?: string[];
}
interface TileResponse {
  tiles: TileListView[];
  next_actionable_tile_id?: string | null;
  next_actionable_start_at?: string | null;
}
function isTileListResponse(value: unknown): value is TileResponse {
  // The v1/tiles endpoint returns a plain JSON array of TileListView objects,
  // not the {tiles: [...]} wrapper this validator was originally written for.
  // Accept both shapes so the dashboard pages (which lean on this hook) render
  // real tile rows instead of an empty state when the daemon is reachable.
  if (Array.isArray(value)) return true;
  return Boolean(
    value && typeof value === "object" && Array.isArray((value as { tiles?: unknown }).tiles),
  );
}

export function useTileList(args: UseTileListArgs = {}) {
  const queryClient = useQueryClient();
  const ownerIdsKey = args.ownerIds?.join(",") ?? "";
  const keyArgs = useMemo(
    () => ({
      viewMode: args.viewMode,
      lifecycle: args.lifecycle,
      limit: args.limit,
      search: args.search,
      excludeFuture: args.excludeFuture,
      range: args.range,
      granularity: args.granularity,
      ownerIds: ownerIdsKey || undefined,
    }),
    [
      args.viewMode,
      args.lifecycle,
      args.limit,
      args.search,
      args.excludeFuture,
      args.range,
      args.granularity,
      ownerIdsKey,
    ],
  );
  const query = useQuery({
    queryKey: [...queryKeys.tiles, keyArgs] as const,
    queryFn: async (): Promise<TileResponse> => {
      const res = await getCoreClient().call<TileResponse | TileListView[]>("getTiles", {
        query: {
          view_mode: args.viewMode,
          lifecycle: args.lifecycle,
          limit: args.limit,
          search: args.search,
          exclude_future: args.excludeFuture,
          range: args.range,
          granularity: args.granularity,
          owner_ids: ownerIdsKey || undefined,
        },
      });
      if (!res.ok) throw new Error(res.error.message);
      if (!isTileListResponse(res.data))
        throw new Error("Unexpected /v1/tiles response shape: missing tiles array");
      // v1/tiles returns a plain array; normalize so downstream consumers can
      // always read .tiles / .next_actionable_tile_id uniformly.
      if (Array.isArray(res.data)) {
        return {
          tiles: res.data,
          next_actionable_tile_id: null,
          next_actionable_start_at: null,
        };
      }
      return res.data;
    },
  });
  useEffect(() => {
    const refresh = () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.tiles });
    };
    window.addEventListener("tastile:tiles-changed", refresh);
    return () => window.removeEventListener("tastile:tiles-changed", refresh);
  }, [queryClient]);
  return {
    tiles: query.data?.tiles ?? [],
    nextActionableTileId: query.data?.next_actionable_tile_id ?? null,
    nextActionableStartAt: query.data?.next_actionable_start_at ?? null,
    loading: query.isPending,
    error: query.error as Error | null,
    refresh: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.tiles });
    },
  };
}

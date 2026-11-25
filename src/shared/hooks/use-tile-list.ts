"use client";

import { getCoreClient } from "@/shared/api/endpoints";
import type { SourceTileSummaryWire } from "@/shared/api/v1/source-tiles";
import { queryKeys } from "@/shared/query/query-keys";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";

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

/**
 * OpenAPI v3.0.0 `GET /v1/tiles` is keyset-paginated
 * (`{items, count, next_cursor}`, page size 1..=1000). `limit` is a page
 * size on the wire; `callAllPages` + `maxItems` reproduce the legacy
 * "first N rows" cap the dashboard callers intend.
 */
const TILE_PAGE_SIZE_MAX = 1000;

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
      const pageSize = Math.min(args.limit ?? TILE_PAGE_SIZE_MAX, TILE_PAGE_SIZE_MAX);
      const res = await getCoreClient().callAllPages<TileListView>("getTiles", {
        query: {
          view_mode: args.viewMode,
          lifecycle: args.lifecycle,
          limit: pageSize,
          search: args.search,
          exclude_future: args.excludeFuture,
          range: args.range,
          granularity: args.granularity,
          owner_ids: ownerIdsKey || undefined,
        },
        maxItems: args.limit,
      });
      if (!res.ok) throw new Error(res.error.message);
      // The paged envelope carries no next-actionable fields; keep the
      // TileResponse shape so downstream consumers stay uniform.
      return {
        tiles: res.data,
        next_actionable_tile_id: null,
        next_actionable_start_at: null,
      };
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

"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { getCoreClient } from "@/lib/api/endpoints";
import type { SourceTileSummaryWire } from "@/lib/api/v1/source-tiles";
import { queryKeys } from "@/lib/query/query-keys";

export interface TileListView {
  id: string; plan_id: string | null; title: string; lifecycle: number; next_action: string | null;
  done_definition: string | null; worked_minutes: number; break_minutes: number; labels: string[];
  objective_mode: number; target_work_min: number | null; target_rest_min: number | null; done_rule: number | null;
  resume_note: string | null; projected_next_start_at: string | null;
  temporal: { release_at: string | null; due_at: string | null; fixed_start: string | null; fixed_end: string | null; active_start: string | null; active_end: string | null } | null;
  recurrence: { step_min: number; window_start_min: number; window_end_min: number; expression: string | null } | null;
  source: SourceTileSummaryWire | null;
}
export interface UseTileListArgs { viewMode?: string; lifecycle?: string; limit?: number; search?: string; excludeFuture?: boolean; range?: string; granularity?: string; ownerIds?: string[]; }
interface TileResponse { tiles: TileListView[]; next_actionable_tile_id?: string | null; next_actionable_start_at?: string | null; }
function isTileListResponse(value: unknown): value is TileResponse { return Boolean(value && typeof value === "object" && Array.isArray((value as { tiles?: unknown }).tiles)); }

export function useTileList(args: UseTileListArgs = {}) {
  const queryClient = useQueryClient();
  const ownerIdsKey = args.ownerIds?.join(",") ?? "";
  const keyArgs = useMemo(() => ({ ...args, ownerIds: ownerIdsKey || undefined }), [args.excludeFuture, args.granularity, args.lifecycle, args.limit, args.range, args.search, args.viewMode, ownerIdsKey]);
  const query = useQuery({
    queryKey: [...queryKeys.tiles, keyArgs] as const,
    queryFn: async (): Promise<TileResponse> => {
      const res = await getCoreClient().call<TileResponse>("getTiles", { query: { view_mode: args.viewMode, lifecycle: args.lifecycle, limit: args.limit, search: args.search, exclude_future: args.excludeFuture, range: args.range, granularity: args.granularity, owner_ids: ownerIdsKey || undefined } });
      if (!res.ok) throw new Error(res.error.message);
      if (!isTileListResponse(res.data)) throw new Error("Unexpected /v1/tiles response shape: missing tiles array");
      return res.data;
    },
  });
  useEffect(() => { const refresh = () => { void queryClient.invalidateQueries({ queryKey: queryKeys.tiles }); }; window.addEventListener("tastile:tiles-changed", refresh); return () => window.removeEventListener("tastile:tiles-changed", refresh); }, [queryClient]);
  return { tiles: query.data?.tiles ?? [], nextActionableTileId: query.data?.next_actionable_tile_id ?? null, nextActionableStartAt: query.data?.next_actionable_start_at ?? null, loading: query.isPending, error: query.error as Error | null, refresh: async () => { await queryClient.invalidateQueries({ queryKey: queryKeys.tiles }); } };
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getCoreClient } from "@/lib/api/endpoints";

/**
 * Mirrors the OpenAPI TileView schema (snake_case).
 * Both /read/tiles and /views/tile-list return this shape.
 */
export interface TileListView {
  id: string;
  plan_id: string | null;
  title: string;
  lifecycle: "ready" | "started" | "done" | "closed";
  next_action: string | null;
  done_definition: string | null;
  worked_minutes: number;
  break_minutes: number;
  semantic_role: "work" | "break" | "label";
  labels: string[];
  objective_mode: "finish_once" | "recurring" | "maximize_within_interval" | "label_only";
  target_work_min: number | null;
  target_rest_min: number | null;
  done_rule: "manual" | "time_reached" | "interval_end" | null;
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

interface HookState {
  tiles: TileListView[];
  nextActionableTileId: string | null;
  nextActionableStartAt: string | null;
  loading: boolean;
  error: Error | null;
}

export function useTileList(args: UseTileListArgs = {}) {
  const [state, setState] = useState<HookState>({
    tiles: [],
    nextActionableTileId: null,
    nextActionableStartAt: null,
    loading: true,
    error: null,
  });
  const mountedRef = useRef(true);
  const requestIdRef = useRef(0);

  const fetchTiles = useCallback(
    async (showLoading: boolean) => {
      const requestId = ++requestIdRef.current;
      if (showLoading) {
        setState((prev) => ({ ...prev, loading: true, error: null }));
      }

      const res = await getCoreClient().call<{
        tiles: TileListView[];
        next_actionable_tile_id?: string | null;
        next_actionable_start_at?: string | null;
      }>("getTiles", {
        query: {
          view_mode: args.viewMode,
          lifecycle: args.lifecycle,
          limit: args.limit,
          search: args.search,
          exclude_future: args.excludeFuture,
          range: args.range,
          granularity: args.granularity,
          owner_ids: args.ownerIds?.length ? args.ownerIds.join(",") : undefined,
        },
      });
      if (!mountedRef.current || requestId !== requestIdRef.current) return;
      if (res.ok) {
        setState({
          tiles: res.data.tiles ?? [],
          nextActionableTileId: res.data.next_actionable_tile_id ?? null,
          nextActionableStartAt: res.data.next_actionable_start_at ?? null,
          loading: false,
          error: null,
        });
      } else {
        setState((prev) => ({ ...prev, loading: false, error: new Error(res.error.message) }));
      }
    },
    [
      args.search,
      args.range,
      args.granularity,
      args.viewMode,
      args.limit,
      args.lifecycle,
      args.excludeFuture,
      args.ownerIds?.join(","),
    ],
  );

  useEffect(() => {
    mountedRef.current = true;
    void fetchTiles(true);

    return () => {
      mountedRef.current = false;
    };
  }, [fetchTiles]);

  useEffect(() => {
    const refresh = () => {
      void fetchTiles(false);
    };
    window.addEventListener("tastile:tiles-changed", refresh);
    return () => window.removeEventListener("tastile:tiles-changed", refresh);
  }, [fetchTiles]);

  return { ...state, refresh: () => fetchTiles(false) };
}

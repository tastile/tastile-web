"use client";

import { useEffect, useRef, useState } from "react";
import { getCoreClient } from "@/lib/api/endpoints";

export interface TileListView {
  id: string;
  title: string;
  lifecycle: "ready" | "started" | "done" | "closed";
  labels: string[];
  targetWorkMin: number | null;
  targetRestMin: number | null;
  dueAt: string | null;
  fixedStart: string | null;
  fixedEnd: string | null;
  nextAction: string | null;
  semanticRole: string;
  objectiveMode: string;
  projectedNextStartAt: string | null;
}

export interface UseTileListArgs {
  viewMode?: "list" | "compact";
  lifecycle?: string;
  limit?: number;
  search?: string;
  excludeFuture?: boolean;
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
  const argsKey = `${args.viewMode ?? ""}:${args.lifecycle ?? ""}:${args.limit ?? ""}:${args.search ?? ""}:${args.excludeFuture ?? ""}`;

  useEffect(() => {
    mountedRef.current = true;
    let cancelled = false;

    async function fetch_() {
      const res = await getCoreClient().call<{
        tiles: TileListView[];
        nextActionableTileId?: string;
        nextActionableStartAt?: string;
      }>("getTileList", {
        query: {
          view_mode: args.viewMode,
          lifecycle: args.lifecycle,
          limit: args.limit,
          search: args.search,
          exclude_future: args.excludeFuture,
        },
      });
      if (cancelled || !mountedRef.current) return;
      if (res.ok) {
        setState({
          tiles: res.data.tiles ?? [],
          nextActionableTileId: res.data.nextActionableTileId ?? null,
          nextActionableStartAt: res.data.nextActionableStartAt ?? null,
          loading: false,
          error: null,
        });
      } else {
        setState((prev) => ({ ...prev, loading: false, error: new Error(res.error.message) }));
      }
    }

    setState((prev) => ({ ...prev, loading: true, error: null }));
    void fetch_();

    return () => {
      cancelled = true;
      mountedRef.current = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- argsKey covers all deps
  }, [argsKey]);

  return state;
}

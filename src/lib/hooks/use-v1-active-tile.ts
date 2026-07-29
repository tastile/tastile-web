"use client";

/**
 * useV1ActiveTile -- polling hook around `GET /v1/active-tile`.
 *
 * Thin wrapper around `useQuery` that:
 *   - dedupes concurrent subscribers via the dashboard QueryClient
 *   - polls every 5 seconds while mounted
 *   - refetches immediately when `tastile:execution-changed` fires
 *   - validates the wire payload at the edge (see
 *     `src/lib/api/v1/active-tile.ts`)
 *
 * The public return shape is preserved so existing consumers
 * (notably `V1ExecutionControls`) keep working unchanged.
 */

import { type V1ActiveTileSnapshot, fetchV1ActiveTile } from "@/lib/api/v1/active-tile";
import { queryKeys } from "@/lib/query/query-keys";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

export type { V1ActiveTileSnapshot } from "@/lib/api/v1/active-tile";

export function useV1ActiveTile(): {
  snapshot: V1ActiveTileSnapshot | null;
  loading: boolean;
  error: Error | null;
} {
  const queryClient = useQueryClient();
  const query = useQuery<V1ActiveTileSnapshot | null, Error>({
    queryKey: queryKeys.activeTile,
    queryFn: async () => {
      const res = await fetchV1ActiveTile();
      if (res.ok) return res.data;
      // Surface structured API failures as a plain Error so the
      // hook's external contract stays `Error | null`, while the
      // original `ApiError` remains reachable via `cause` for any
      // caller that needs the kind/status/body.
      const apiError = new Error(res.error.message);
      (apiError as Error & { cause?: unknown }).cause = res.error;
      throw apiError;
    },
    refetchInterval: 5_000,
    refetchIntervalInBackground: false,
    retry: false,
  });

  useEffect(() => {
    const onChanged = () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.activeTile });
    };
    window.addEventListener("tastile:execution-changed", onChanged);
    return () => {
      window.removeEventListener("tastile:execution-changed", onChanged);
    };
  }, [queryClient]);

  return {
    snapshot: query.data ?? null,
    loading: query.isLoading,
    error: query.error ?? null,
  };
}

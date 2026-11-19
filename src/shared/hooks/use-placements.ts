"use client";

import { getCoreClient } from "@/shared/api/endpoints";
import { queryKeys } from "@/shared/query/query-keys";
import { useQuery, useQueryClient } from "@tanstack/react-query";

/**
 * Wire shapes mirror OpenAPI `PlacementListItem` / `CandidatePlacementSchema`
 * (`GET /v1/placements` and `GET /v1/candidates`). Both endpoints are
 * keyset-paginated (`{items, count, next_cursor}`); the schedule panel needs
 * the complete sets, so `callAllPages` follows every cursor.
 */
interface PlacementListItemWire {
  placement_id: string;
  tile_id: string;
  title: string;
  span_start: string | null;
  span_end: string | null;
}

interface CandidatePlacementWire {
  placement_id: string;
  tile_id: string;
  title: string;
  priority: number;
  span_start: string | null;
  span_end: string | null;
}

interface PlacementRow {
  id: string;
  work_tile_id: string;
  title: string;
  span_start: string | null;
  span_end: string | null;
  planned_minutes: number | null;
}

interface CandidateRow {
  placement_id: string;
  tile_id: string;
  title: string;
  priority: number;
}

function plannedMinutes(spanStart: string | null, spanEnd: string | null): number | null {
  if (!spanStart || !spanEnd) return null;
  const ms = Date.parse(spanEnd) - Date.parse(spanStart);
  if (!Number.isFinite(ms) || ms < 0) return null;
  return Math.round(ms / 60_000);
}

const placementsOptions = {
  queryKey: queryKeys.placements,
  queryFn: async () => {
    const res = await getCoreClient().callAllPages<PlacementListItemWire>("getPlacements");
    if (!res.ok) throw new Error(res.error.message);
    return res.data.map(
      (p): PlacementRow => ({
        id: p.placement_id,
        work_tile_id: p.tile_id,
        title: p.title,
        span_start: p.span_start,
        span_end: p.span_end,
        planned_minutes: plannedMinutes(p.span_start, p.span_end),
      }),
    );
  },
};
const candidatesOptions = {
  queryKey: queryKeys.candidates,
  queryFn: async () => {
    const res = await getCoreClient().callAllPages<CandidatePlacementWire>("getCandidates");
    if (!res.ok) throw new Error(res.error.message);
    return res.data.map(
      (c): CandidateRow => ({
        placement_id: c.placement_id,
        tile_id: c.tile_id,
        title: c.title,
        priority: c.priority,
      }),
    );
  },
};
export function usePlacements() {
  const query = useQuery(placementsOptions);
  const client = useQueryClient();
  return {
    placements: query.data ?? [],
    loading: query.isPending,
    error: query.error as Error | null,
    refresh: async () => {
      await client.refetchQueries({ queryKey: queryKeys.placements });
    },
  };
}
export function useCandidates() {
  const query = useQuery(candidatesOptions);
  return {
    candidates: query.data ?? [],
    loading: query.isPending,
    error: query.error as Error | null,
    refresh: async () => {
      await query.refetch();
    },
  };
}

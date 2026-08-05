"use client";

import { getCoreClient } from "@/shared/api/endpoints";
import { queryKeys } from "@/shared/query/query-keys";
import { useQuery, useQueryClient } from "@tanstack/react-query";

interface PlacementRow {
  id: string;
  work_tile_id: string;
  time_tile_id: string;
  planned_minutes: number;
}
interface CandidateRow {
  work_tile_id: string;
}
const placementsOptions = {
  queryKey: queryKeys.placements,
  queryFn: async () => {
    const res = await getCoreClient().call<{ placements: PlacementRow[] }>("getPlacements");
    if (!res.ok) throw new Error(res.error.message);
    return res.data.placements ?? [];
  },
};
const candidatesOptions = {
  queryKey: queryKeys.candidates,
  queryFn: async () => {
    const res = await getCoreClient().call<{ candidates: CandidateRow[] }>("getCandidates");
    if (!res.ok) throw new Error(res.error.message);
    return res.data.candidates ?? [];
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

"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getCoreClient } from "@/lib/api/endpoints";
import { queryKeys } from "@/lib/query/query-keys";

export interface PlacementRow { id: string; work_tile_id: string; time_tile_id: string; planned_minutes: number; }
export interface CandidateRow { work_tile_id: string; }
const placementsOptions = { queryKey: queryKeys.placements, queryFn: async () => { const res = await getCoreClient().call<{ placements: PlacementRow[] }>("getPlacements"); if (!res.ok) throw new Error(res.error.message); return res.data.placements ?? []; } };
const candidatesOptions = { queryKey: queryKeys.candidates, queryFn: async () => { const res = await getCoreClient().call<{ candidates: CandidateRow[] }>("getCandidates"); if (!res.ok) throw new Error(res.error.message); return res.data.candidates ?? []; } };
export function usePlacements() { const query = useQuery(placementsOptions); const client = useQueryClient(); return { placements: query.data ?? [], loading: query.isPending, error: query.error as Error | null, refresh: async () => { await client.refetchQueries({ queryKey: queryKeys.placements }); } }; }
export function useCandidates() { const query = useQuery(candidatesOptions); return { candidates: query.data ?? [], loading: query.isPending, error: query.error as Error | null, refresh: async () => { await query.refetch(); } }; }

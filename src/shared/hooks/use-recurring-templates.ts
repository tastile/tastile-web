"use client";

import { getCoreClient } from "@/shared/api/endpoints";
import type { TileListView } from "@/shared/hooks/use-tile-list";
import { queryKeys } from "@/shared/query/query-keys";
import { useQuery } from "@tanstack/react-query";

/**
 * Legacy `RecurringTemplateListItem` shape that the schedule UI consumes
 * (`ScheduleMain.tsx` `describeGenerator` + `formatWindow`). v1 replaced the
 * `Recurring` tile kind with `SourceTile` (kind=3); recurring data now lives
 * on `TileListView.source`, not on a separate `recurrence` field. The mapper
 * below projects source-tile rows into the legacy shape so the existing UI
 * binding keeps working without touching `ScheduleMain.tsx`.
 */
export interface RecurringTemplateListItem {
  id: string;
  title: string;
  note: string;
  recurrence: {
    generator: {
      focus_block_based?: { phases: Array<{ focus_min: number; break_min: number }> };
      step_min?: number;
    };
    window: { weekday_mask: number; start_offset_min: number; end_offset_min: number };
    selector: { expression: unknown | null };
  };
}

/**
 * All v1 SourceTiles are surfaced as "recurring templates" in the UI: the
 * legacy v7-era `Recurring` kind was replaced by `SourceTile` (kind=3) with
 * `generation_kind ∈ {ONESHOT=0, RECURRING=1, DEMAND=2}` per `v1/HARNESS.md`.
 * Each SourceTile's window + schedule describes a reusable template the user
 * can edit, so legacy v1_tile rows (`source == null`) are filtered out and
 * source-tile rows of any generation kind are projected uniformly.
 */
function projectRecurringTemplate(tile: TileListView): RecurringTemplateListItem | null {
  const source = tile.source;
  if (!source) return null;
  return {
    id: tile.id,
    title: tile.title,
    note: "",
    recurrence: {
      generator: {},
      window: {
        weekday_mask: source.weekday_mask ?? 0,
        start_offset_min: Math.round(source.window_start_offset_ms / 60_000),
        end_offset_min: Math.round(source.window_end_offset_ms / 60_000),
      },
      selector: { expression: null },
    },
  };
}

const recurringTemplatesQueryOptions = {
  queryKey: queryKeys.recurringTemplates,
  queryFn: async (): Promise<RecurringTemplateListItem[]> => {
    // /v1/tiles returns the unified tile list (legacy v1_tile UNION v1_source_tile
    // per HARNESS.md §5 "list_tiles UNION with v1_source_tile — 2026-07-23").
    // Filter to recurring SourceTiles in the mapper; passing no params keeps
    // the response identical to `useTileList` so the two hooks could share a
    // cache key in a follow-up.
    const res = await getCoreClient().call<TileListView[]>("getTiles");
    if (!res.ok) throw new Error(res.error.message);
    const tiles = Array.isArray(res.data) ? res.data : [];
    return tiles
      .map(projectRecurringTemplate)
      .filter((template): template is RecurringTemplateListItem => template !== null);
  },
};

export function useRecurringTemplates() {
  const query = useQuery(recurringTemplatesQueryOptions);
  return {
    templates: query.data ?? [],
    loading: query.isPending,
    error: query.error as Error | null,
  };
}
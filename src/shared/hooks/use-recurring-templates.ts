"use client";

import { getCoreClient } from "@/shared/api/endpoints";
import { queryKeys } from "@/shared/query/query-keys";
import { useQuery } from "@tanstack/react-query";

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

export const recurringTemplatesQueryOptions = {
  queryKey: queryKeys.recurringTemplates,
  queryFn: async (): Promise<RecurringTemplateListItem[]> => {
    const res = await getCoreClient().call<RecurringTemplateListItem[]>("listRecurringTiles");
    if (!res.ok) throw new Error(res.error.message);
    return res.data ?? [];
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

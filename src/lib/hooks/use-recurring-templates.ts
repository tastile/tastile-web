"use client";

import { useEffect, useRef, useState } from "react";
import { getCoreClient } from "@/lib/api/endpoints";

export interface RecurringTemplateListItem {
  id: string;
  title: string;
  note: string;
  recurrence: {
    generator: {
      focus_block_based?: { phases: Array<{ focus_min: number; break_min: number }> };
      step_min?: number;
    };
    window: {
      weekday_mask: number;
      start_offset_min: number;
      end_offset_min: number;
    };
    selector: {
      expression: unknown | null;
    };
  };
}

interface HookState {
  templates: RecurringTemplateListItem[];
  loading: boolean;
  error: Error | null;
}

export function useRecurringTemplates() {
  const [state, setState] = useState<HookState>({
    templates: [],
    loading: true,
    error: null,
  });
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    let cancelled = false;

    async function fetch_() {
      const res = await getCoreClient().call<RecurringTemplateListItem[]>("listRecurringTiles");
      if (cancelled || !mountedRef.current) return;
      if (res.ok) {
        setState({ templates: res.data ?? [], loading: false, error: null });
      } else {
        setState({ templates: [], loading: false, error: new Error(res.error.message) });
      }
    }

    setState((prev) => ({ ...prev, loading: true, error: null }));
    void fetch_();

    return () => {
      cancelled = true;
      mountedRef.current = false;
    };
  }, []);

  return state;
}

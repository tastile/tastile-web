"use client";

import { useEffect, useRef, useState } from "react";
import { getCoreClient } from "@/lib/api/endpoints";

export type CalendarView = "day" | "week" | "month" | "year";

export interface CalendarBlockView {
  tile_id: string | null;
  title: string;
  kind: "work" | "break" | "label" | "scheduled";
  is_active: boolean;
  start_at: string;
  end_at: string;
  semantic_role: "work" | "break" | "label";
  all_day: boolean;
  ownership: "tastile_owned" | "remote_owned" | "synthetic";
  editable: boolean;
  source_label: string;
}

export interface CalendarProjectionView {
  view: CalendarView;
  range_start: string;
  range_end: string;
  grid_start: string;
  grid_end: string;
  blocks: CalendarBlockView[];
  all_day_spans: CalendarBlockView[];
  overflow_counters: Record<string, number>;
  month_summaries: unknown[];
}

export interface UseCalendarProjectionArgs {
  view: CalendarView;
  anchor: string;
  tzOffset: number;
}

interface HookState {
  projection: CalendarProjectionView | null;
  loading: boolean;
  error: Error | null;
}

export function useCalendarProjection(args: UseCalendarProjectionArgs) {
  const [state, setState] = useState<HookState>({ projection: null, loading: true, error: null });
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    let cancelled = false;

    async function fetch_() {
      const anchorRfc = args.anchor.includes("T") ? args.anchor : `${args.anchor}T00:00:00Z`;
      const res = await getCoreClient().call<CalendarProjectionView>(
        args.view === "day"
          ? "getCalendarDay"
          : args.view === "week"
            ? "getCalendarWeek"
            : args.view === "month"
              ? "getCalendarMonth"
              : "getCalendarYear",
        { query: { anchor: anchorRfc, tz_offset: args.tzOffset * 60 } },
      );
      if (cancelled || !mountedRef.current) return;
      setState(
        res.ok
          ? { projection: res.data, loading: false, error: null }
          : { projection: null, loading: false, error: new Error(res.error.message) },
      );
    }

    setState((prev) => ({ ...prev, loading: true, error: null }));
    void fetch_();

    return () => {
      cancelled = true;
      mountedRef.current = false;
    };
  }, [args.anchor.includes, args.tzOffset, args.view, args.anchor]);

  return state;
}

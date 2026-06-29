"use client";

import { useEffect, useState } from "react";
import { getCoreClient } from "@/lib/api/endpoints";
import type { TimelineItem } from "@/lib/domain/v1/timeline-item";
import {
  timelineResponseToBlocks,
  type CalendarBlockView,
  type TimelineProjection,
} from "@/lib/projection/timeline-to-blocks";

export type { CalendarBlockView } from "@/lib/projection/timeline-to-blocks";
export type CalendarView = "day" | "week" | "month" | "year";

export interface UseCalendarProjectionArgs {
  view: CalendarView;
  anchor: string;
  tzOffset: number;
}

interface HookState {
  projection: TimelineProjection | null;
  loading: boolean;
  error: Error | null;
}

export function resolveWindowForView(
  view: CalendarView,
  anchor: string,
  tzOffsetMinutes: number,
): { start: string; end: string } {
  const parts = anchor.split("-").map(Number);
  const [y, m, d] = parts;
  if (
    parts.length !== 3 ||
    !Number.isInteger(y) || y < 1970 || y > 9999 ||
    !Number.isInteger(m) || m < 1 || m > 12 ||
    !Number.isInteger(d) || d < 1 || d > 31
  ) {
    throw new RangeError(`resolveWindowForView: invalid anchor '${anchor}' (expected YYYY-MM-DD)`);
  }
  const startUtcMs = Date.UTC(y, m - 1, d, 0, 0, 0) - tzOffsetMinutes * 60_000;
  const start = new Date(startUtcMs);
  const end = new Date(startUtcMs);
  switch (view) {
    case "day": end.setUTCDate(end.getUTCDate() + 1); break;
    case "week": end.setUTCDate(end.getUTCDate() + 7); break;
    case "month": end.setUTCMonth(end.getUTCMonth() + 1); break;
    case "year": end.setUTCFullYear(end.getUTCFullYear() + 1); break;
  }
  return { start: start.toISOString(), end: end.toISOString() };
}

export function useCalendarProjection(args: UseCalendarProjectionArgs) {
  const [state, setState] = useState<HookState>({ projection: null, loading: true, error: null });

  useEffect(() => {
    let cancelled = false;
    async function fetch_() {
      const endpointKey =
        args.view === "day" ? "getCalendarDay"
          : args.view === "week" ? "getCalendarWeek"
          : args.view === "month" ? "getCalendarMonth"
          : "getCalendarYear";
      let res;
      try {
        const { start, end } = resolveWindowForView(args.view, args.anchor, args.tzOffset);
        res = await getCoreClient().call<TimelineItem[]>(endpointKey, {
          query: { start, end },
        });
      } catch (err) {
        if (cancelled) return;
        setState({ projection: null, loading: false, error: err instanceof Error ? err : new Error(String(err)) });
        return;
      }
      if (cancelled) return;
      setState(
        res.ok
          ? { projection: timelineResponseToBlocks(res.data), loading: false, error: null }
          : { projection: null, loading: false, error: new Error(res.error.message) },
      );
    }
    setState((prev) => ({ ...prev, loading: true, error: null }));
    void fetch_();
    return () => { cancelled = true; };
  }, [args.view, args.anchor, args.tzOffset]);

  return state;
}

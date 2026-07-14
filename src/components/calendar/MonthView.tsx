"use client";

import { useEffect, useMemo, useState } from "react";
import {
  type DisplayMode,
  eventSpansDay,
  getMonthViewDates,
} from "@/lib/calendar/layout";
import type { CalendarEvent } from "@/lib/domain/calendar";
import { cn } from "@/lib/utils/cn";
import { MonthEventTile } from "./MonthEventTile";
import { MonthViewFrame } from "./MonthViewFrame";

function chunkWeeks(dates: string[]): string[][] {
  const weeks: string[][] = [];
  for (let i = 0; i < dates.length; i += 7) {
    weeks.push(dates.slice(i, i + 7));
  }
  return weeks;
}

export interface MonthViewProps {
  anchor: string;
  mode: DisplayMode;
  tzOffset: number;
  events: CalendarEvent[];
  loading: boolean;
}

export function MonthView({ anchor, mode, tzOffset, events }: MonthViewProps) {
  const [todayStr, setTodayStr] = useState("");

  useEffect(() => {
    setTodayStr(new Date(Date.now() + tzOffset * 60_000).toISOString().slice(0, 10));
  }, [tzOffset]);

  const weeks = useMemo(
    () => chunkWeeks(getMonthViewDates(mode, anchor, tzOffset)),
    [mode, anchor, tzOffset],
  );

  // Frame (weekday header + month grid + date numbers) is always
  // rendered so the shell never flashes between a "Loading…" placeholder
  // and the grid. While events are in-flight, the cells stay empty and
  // tiles fill in once the fetch resolves. MonthViewFrame is memo'd
  // so its (static) cells don't repaint when only `events` change.
  return (
    <MonthViewFrame
      weeks={weeks}
      anchor={anchor}
      cellArea={(dateStr) => {
        const dateObj = new Date(`${dateStr}T00:00:00Z`);
        const isToday = dateStr === todayStr;
        const dayEvents = events.filter((e) => eventSpansDay(e, dateStr, tzOffset));
        const visible = dayEvents.slice(0, 3);
        const overflow = dayEvents.length - visible.length;

        return (
          <>
            <div className="flex justify-between items-center px-1">
              <span
                className={cn(
                  "text-xs font-medium h-6 w-6 flex items-center justify-center rounded-full",
                  isToday ? "bg-primary text-primary-fg" : "text-foreground-subtle",
                )}
              >
                {dateObj.getUTCDate()}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-1 px-0.5 no-scrollbar">
              {visible.map((event) => (
                <MonthEventTile key={event.id} event={event} />
              ))}
              {overflow > 0 ? (
                <div className="text-[10px] text-foreground-subtle px-1">+{overflow} more</div>
              ) : null}
            </div>
          </>
        );
      }}
    />
  );
}

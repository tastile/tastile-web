"use client";

import { useEffect, useMemo, useState } from "react";
import {
  type DisplayMode,
  eventSpansDay,
  getMonthViewDates,
  monthEventStyle,
} from "@/lib/calendar/layout";
import type { CalendarEvent } from "@/lib/domain/calendar";
import { cn } from "@/lib/utils/cn";

function chunkWeeks(dates: string[]): string[][] {
  const weeks: string[][] = [];
  for (let i = 0; i < dates.length; i += 7) {
    weeks.push(dates.slice(i, i + 7));
  }
  return weeks;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
}

export interface MonthViewProps {
  anchor: string;
  mode: DisplayMode;
  tzOffset: number;
  events: CalendarEvent[];
  loading: boolean;
}

export function MonthView({ anchor, mode, tzOffset, events, loading }: MonthViewProps) {
  const [todayStr, setTodayStr] = useState("");

  useEffect(() => {
    setTodayStr(new Date(Date.now() + tzOffset * 60_000).toISOString().slice(0, 10));
  }, [tzOffset]);

  const weeks = useMemo(
    () => chunkWeeks(getMonthViewDates(mode, anchor, tzOffset)),
    [mode, anchor, tzOffset],
  );

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-xs text-foreground-subtle">
        Loading…
      </div>
    );
  }
  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const d = new Date(`${anchor}T00:00:00Z`);
  const currentMonth = d.getUTCMonth();

  return (
    <div className="flex flex-col h-full border border-surface-2 rounded-md overflow-clip bg-surface-0 min-h-[600px]">
      <div className="sticky top-0 z-30 grid grid-cols-7 border-b border-surface-2 bg-surface-1">
        {weekdays.map((day) => (
          <div
            key={day}
            className="py-2 text-center text-xs font-medium text-foreground-subtle border-r border-surface-2 last:border-r-0"
          >
            {day}
          </div>
        ))}
      </div>

      <div className="flex flex-col flex-1">
        {weeks.map((week, wIdx) => (
          <div
            key={wIdx}
            className="grid grid-cols-7 flex-1 border-b border-surface-2 last:border-b-0 min-h-[120px]"
          >
            {week.map((dateStr) => {
              const dateObj = new Date(`${dateStr}T00:00:00Z`);
              const isCurrentMonth = dateObj.getUTCMonth() === currentMonth;
              const isToday = dateStr === todayStr;
              const dayEvents = events.filter((e) => eventSpansDay(e, dateStr, tzOffset));
              const visible = dayEvents.slice(0, 3);
              const overflow = dayEvents.length - visible.length;

              return (
                <div
                  key={dateStr}
                  data-testid={`month-day-${dateStr}`}
                  className={cn(
                    "p-1 border-r border-surface-2 last:border-r-0 flex flex-col gap-1 overflow-hidden",
                    !isCurrentMonth && "bg-surface-1 opacity-50",
                  )}
                >
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
                    {visible.map((event) => {
                      const tile = monthEventStyle(event.color);
                      return (
                        <button
                          key={event.id}
                          type="button"
                          data-testid={`month-event-${event.id}`}
                          className="block w-full truncate rounded-sm px-1.5 py-0.5 text-left text-[10px] hover:brightness-95"
                          style={{
                            backgroundColor: tile.backgroundColor,
                            color: tile.color,
                          }}
                        >
                          {event.allDay ? "" : `${formatTime(event.start)} `}
                          {event.title}
                        </button>
                      );
                    })}
                    {overflow > 0 ? (
                      <div className="text-[10px] text-foreground-subtle px-1">
                        +{overflow} more
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

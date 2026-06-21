"use client";

import { useCalendarProjection } from "@/lib/hooks/use-calendar-projection";
import { useReferenceOverlayStore } from "@/lib/stores/reference-overlay-store";
import { blocksForDate, allDayBlocksFor } from "@/lib/projection/calendar-projection";
import { cn } from "@/lib/utils/cn";

function getMonthWeeks(anchor: string): string[][] {
  const d = new Date(anchor + "T00:00:00Z");
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth();
  
  const firstDay = new Date(Date.UTC(year, month, 1));
  const lastDay = new Date(Date.UTC(year, month + 1, 0));
  
  const startDate = new Date(firstDay);
  startDate.setUTCDate(startDate.getUTCDate() - startDate.getUTCDay()); // Back to Sunday
  
  const endDate = new Date(lastDay);
  if (endDate.getUTCDay() !== 6) {
    endDate.setUTCDate(endDate.getUTCDate() + (6 - endDate.getUTCDay())); // Forward to Saturday
  }
  
  const weeks: string[][] = [];
  let currentWeek: string[] = [];
  const curr = new Date(startDate);
  
  while (curr <= endDate) {
    currentWeek.push(curr.toISOString().slice(0, 10));
    curr.setUTCDate(curr.getUTCDate() + 1);
    if (currentWeek.length === 7) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
  }
  return weeks;
}

export function MonthView({ anchor, tzOffset, refreshKey }: { anchor: string; tzOffset: number; refreshKey?: number }) {
  const { projection, loading, error } = useCalendarProjection({ view: "month", anchor, tzOffset, refreshKey });
  const enabled = useReferenceOverlayStore((s) => s.enabled);
  
  if (error) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2 text-xs">
        <span className="text-danger">Failed to load calendar</span>
        <span className="text-foreground-subtle">{error.message}</span>
      </div>
    );
  }

  if (loading || !projection) {
    return <div className="flex h-64 items-center justify-center text-xs text-foreground-subtle">Loading…</div>;
  }

  const weeks = getMonthWeeks(anchor);
  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  
  const d = new Date(anchor + "T00:00:00Z");
  const currentMonth = d.getUTCMonth();
  const todayStr = new Date(Date.now() + tzOffset * 60_000).toISOString().slice(0, 10);

  return (
    <div className="flex flex-col h-full border border-surface-2 rounded-md overflow-hidden bg-surface-0 min-h-[600px]">
      {/* Header */}
      <div className="grid grid-cols-7 border-b border-surface-2 bg-surface-1">
        {weekdays.map((day) => (
          <div key={day} className="py-2 text-center text-xs font-medium text-foreground-subtle border-r border-surface-2 last:border-r-0">
            {day}
          </div>
        ))}
      </div>
      
      {/* Grid */}
      <div className="flex flex-col flex-1">
        {weeks.map((week, wIdx) => (
          <div key={wIdx} className="grid grid-cols-7 flex-1 border-b border-surface-2 last:border-b-0 min-h-[120px]">
            {week.map((dateStr) => {
              const dateObj = new Date(dateStr + "T00:00:00Z");
              const isCurrentMonth = dateObj.getUTCMonth() === currentMonth;
              const isToday = dateStr === todayStr;
              const dayBlocks = blocksForDate(projection, dateStr);
              const allDay = allDayBlocksFor(projection, dateStr);
              const combinedBlocks = [...allDay, ...dayBlocks];
              
              return (
                <div key={dateStr} className={cn(
                  "p-1 border-r border-surface-2 last:border-r-0 flex flex-col gap-1 overflow-hidden",
                  !isCurrentMonth && "bg-surface-1 opacity-50"
                )}>
                  <div className="flex justify-between items-center px-1">
                    <span className={cn(
                      "text-xs font-medium h-6 w-6 flex items-center justify-center rounded-full",
                      isToday ? "bg-primary text-primary-fg" : "text-foreground-subtle"
                    )}>
                      {dateObj.getUTCDate()}
                    </span>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto space-y-1 px-0.5 no-scrollbar">
                    {combinedBlocks.map((b, i) => {
                      const isDimmed = enabled.length > 0 && !enabled.includes(b.source_label);
                      return (
                        <div
                          key={i}
                          className={cn(
                            "text-[10px] truncate px-1.5 py-0.5 rounded-sm",
                            isDimmed ? "opacity-30" : "opacity-100",
                            b.semantic_role === "work" ? "bg-primary/20 text-primary border border-primary/20" :
                            b.semantic_role === "break" ? "bg-success/20 text-success border border-success/20" :
                            "bg-surface-2 text-foreground border border-border"
                          )}
                        >
                          {b.title}
                        </div>
                      );
                    })}
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

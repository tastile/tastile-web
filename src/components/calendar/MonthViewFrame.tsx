"use client";

import { cn } from "@/lib/utils/cn";
import { type ReactNode, memo } from "react";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export interface MonthViewFrameProps {
  /** Six rows of seven YYYY-MM-DD strings each (Sun..Sat ordering). */
  weeks: string[][];
  /** Anchor YYYY-MM-DD; used to determine the displayed month highlight. */
  anchor: string;
  /** Dynamic content rendered inside each cell. */
  cellArea: (dateStr: string) => ReactNode;
}

/**
 * Static template for the month-view shell: weekday header row and
 * the 6×7 date-cell grid. Memoized so the parent's events fetch and
 * `todayStr` recomputation don't repaint the frame.
 */
function MonthViewFrameImpl({ weeks, anchor, cellArea }: MonthViewFrameProps) {
  const d = new Date(`${anchor}T00:00:00Z`);
  const currentMonth = d.getUTCMonth();

  return (
    <div className="flex h-full flex-col overflow-hidden border border-surface-2 rounded-md bg-surface-0">
      <div className="grid grid-cols-7 border-b border-surface-2 bg-surface-1">
        {WEEKDAYS.map((day) => (
          <div
            key={day}
            className="py-2 text-center text-xs font-medium text-foreground-subtle border-r border-surface-2 last:border-r-0"
          >
            {day}
          </div>
        ))}
      </div>

      <div
        className="grid min-h-0 flex-1"
        style={{ gridTemplateRows: `repeat(${weeks.length}, minmax(0, 1fr))` }}
      >
        {weeks.map((week, wIdx) => (
          <div
            key={wIdx}
            className="grid min-h-0 grid-cols-7 border-b border-surface-2 last:border-b-0"
          >
            {week.map((dateStr) => {
              const dateObj = new Date(`${dateStr}T00:00:00Z`);
              const isCurrentMonth = dateObj.getUTCMonth() === currentMonth;
              return (
                <div
                  key={dateStr}
                  data-testid={`month-day-${dateStr}`}
                  className={cn(
                    "min-h-0 p-1 border-r border-surface-2 last:border-r-0 flex flex-col gap-1 overflow-hidden",
                    !isCurrentMonth && "bg-surface-1 opacity-50",
                  )}
                >
                  {cellArea(dateStr)}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

export const MonthViewFrame = memo(MonthViewFrameImpl);

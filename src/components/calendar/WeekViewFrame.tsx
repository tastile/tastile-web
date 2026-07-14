"use client";

import { memo, type ReactNode, type Ref } from "react";
import { cn } from "@/lib/utils/cn";

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

export interface WeekViewFrameProps {
  gridRef: Ref<HTMLDivElement>;
  hourHeight: number;
  /** Seven YYYY-MM-DD strings, Sun..Sat. */
  weekDates: string[];
  /** YYYY-MM-DD for the today-highlight column (local date). */
  todayLocal: string;
  /** Stable callback from parent (useCallback). */
  onCreateAtSlot?: (anchor: string, hour: number) => void;
  /** Dynamic content rendered in each day column's ALL DAY cell. */
  allDayArea: (date: string) => ReactNode;
  /** Dynamic content rendered in each day column's time grid (tiles, NowIndicator). */
  eventsArea: (date: string) => ReactNode;
}

/**
 * Static template for the week-view shell: weekday header row, ALL DAY
 * bar, hour gutter, and the seven time-grid columns with slot buttons.
 * Memoized so the parent's `nowMs` tick or any unrelated state change
 * does NOT repaint the frame — only `allDayArea` / `eventsArea`
 * re-render per day column.
 */
function WeekViewFrameImpl({
  gridRef,
  hourHeight,
  weekDates,
  todayLocal,
  onCreateAtSlot,
  allDayArea,
  eventsArea,
}: WeekViewFrameProps) {
  return (
    <div className="flex flex-col rounded-md border border-surface-2 bg-surface-0 overflow-clip">
      <div className="sticky top-12 z-30 bg-surface-1">
        <div
          className="grid border-b border-surface-2"
          style={{ gridTemplateColumns: "4rem repeat(7, 1fr)" }}
        >
          <div className="border-r border-surface-2" />
          {weekDates.map((d) => {
            const dd = new Date(`${d}T00:00:00Z`);
            const isToday = d === todayLocal;
            return (
              <div
                key={d}
                className={cn(
                  "flex flex-col items-center border-r border-surface-2 py-1.5 text-[11px] last:border-r-0",
                  isToday && "bg-surface-2/40",
                )}
              >
                <span className="font-semibold uppercase tracking-wider text-foreground-subtle">
                  {WEEKDAYS[dd.getUTCDay()]}
                </span>
                <span
                  className={cn(
                    "mt-0.5 text-sm font-semibold",
                    isToday ? "text-primary" : "text-foreground",
                  )}
                >
                  {dd.getDate()}
                </span>
              </div>
            );
          })}
        </div>
        <div
          className="grid border-b border-surface-2"
          style={{ gridTemplateColumns: "4rem repeat(7, 1fr)" }}
        >
          <div className="flex items-center justify-center border-r border-surface-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-foreground-subtle">
            All day
          </div>
          {weekDates.map((d) => (
            <div
              key={d}
              data-testid={`week-all-day-${d}`}
              className="min-h-[40px] border-r border-surface-2 px-1 py-1 last:border-r-0"
            >
              {allDayArea(d)}
            </div>
          ))}
        </div>
      </div>
      <div
        ref={gridRef}
        className="relative grid"
        style={{ gridTemplateColumns: "4rem repeat(7, 1fr)", height: `${24 * hourHeight}px` }}
      >
        <div className="flex flex-col border-r border-surface-2">
          {HOURS.map((h) => (
            <div
              key={h}
              className="flex items-start justify-end border-b border-surface-2/60 pr-2 pt-1"
              style={{ height: `${hourHeight}px` }}
            >
              <span className="font-mono text-[10px] text-foreground-subtle">{pad(h)}:00</span>
            </div>
          ))}
        </div>
        {weekDates.map((d) => (
          <div
            key={d}
            data-testid={`week-day-${d}`}
            className="relative border-r border-surface-2 last:border-r-0"
          >
            {HOURS.map((h) => (
              <button
                key={h}
                type="button"
                data-testid={`week-slot-${d}-${pad(h)}`}
                onClick={onCreateAtSlot ? () => onCreateAtSlot(d, h) : undefined}
                className="block w-full border-b border-surface-2/60 text-left hover:bg-surface-1/40 focus:outline-hidden focus-visible:bg-surface-1/40"
                style={{ height: `${hourHeight}px`, padding: 0 }}
              />
            ))}
            {eventsArea(d)}
          </div>
        ))}
      </div>
    </div>
  );
}

export const WeekViewFrame = memo(WeekViewFrameImpl);

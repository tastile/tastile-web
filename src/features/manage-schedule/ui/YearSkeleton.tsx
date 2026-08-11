// src/components/schedule/YearSkeleton.tsx
"use client";

import { Skeleton } from "@mantine/core";

/**
 * Mirrors the layout of `YearView`: 12 month blocks arranged in a 3-column
 * grid (matches `.yearViewMonths` in YearView.module.css — columns fall
 * back to 2 / 1 via container queries at 750 / 420 px, so the skeleton
 * uses the same grid setup so it tracks the same responsive breakpoints).
 * Each block imitates `.yearViewMonth`: a caption, a 7-cell weekday
 * header row, then ~6 weeks of circular day cells (border-radius 100%,
 * aspect-ratio 1). Sized to the same padding scale as the real view so
 * the skeleton occupies the same visual footprint.
 */
export function YearSkeleton() {
  return (
    <div className="h-full" data-testid="year-skeleton">
      <div
        className="grid grid-cols-3 flex-1 overflow-y-auto align-content-start"
        style={{ containerType: "inline-size" } as React.CSSProperties}
        data-testid="year-skeleton-months"
      >
        {Array.from({ length: 12 }, (_, monthIndex) => (
          <MonthSkeleton key={monthIndex} />
        ))}
      </div>
    </div>
  );
}

function MonthSkeleton() {
  return (
    <div className="min-w-0 p-4" data-testid="year-skeleton-month">
      {/* Month caption — matches `.yearViewMonthCaption`: bold, full-width. */}
      <Skeleton height={20} width="55%" radius="sm" mb="sm" />
      {/* Weekday header row — 7 narrow strips, mirrors `.yearViewWeekday` height. */}
      <div className="mb-2 flex gap-0">
        {Array.from({ length: 7 }, (_, i) => (
          <div key={i} className="flex-1 px-1">
            <Skeleton height={14} radius="sm" />
          </div>
        ))}
      </div>
      {/* Day cells — 6 weeks × 7 days of circular placeholders
          (aspect-ratio 1, border-radius 100%) so the footprint
          matches `.yearViewDay`. */}
      {Array.from({ length: 6 }, (_, weekIndex) => (
        <div key={weekIndex} className="flex gap-0">
          {Array.from({ length: 7 }, (_, dayIndex) => (
            <div key={dayIndex} className="flex-1 p-[2px]">
              <Skeleton circle height="100%" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
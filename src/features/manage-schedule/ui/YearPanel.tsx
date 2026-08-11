// src/components/schedule/YearPanel.tsx
"use client";

import type { CalendarEvent } from "@/calendar/model/calendar";
import type { DisplayMode, DisplayRange } from "@/lib/calendar/layout";
import { YearView } from "@/lib/vendored/mantine-schedule";
import { ErrorBanner } from "./ErrorBanner";
import { YearSkeleton } from "./YearSkeleton";
import { toScheduleEvents } from "./eventAdapter";
import { useResponsiveBreakpoint } from "./useResponsiveBreakpoint";

type Props = {
  range: DisplayRange;
  anchor: string;
  zoom: number;
  displayMode: DisplayMode;
  events: CalendarEvent[];
  loading: boolean;
  error: Error | null;
  onEventClick: (event: CalendarEvent) => void;
};

export function YearPanel({ range, anchor, zoom, displayMode, events, loading, error }: Props) {
  void range;
  void zoom;
  void displayMode;
  const breakpoint = useResponsiveBreakpoint();
  // YearView in @/lib/vendored/mantine-schedule does not expose renderEventBody or
  // onEventClick — it renders each day's events as up to 3 colored
  // indicator dots. Props that do not apply to this view (zoom, range,
  // onEventClick) are kept in the type contract for parity with the
  // other panels but ignored here.
  const scheduleEvents = events.flatMap(toScheduleEvents);
  const showSkeleton = loading && events.length === 0;
  const isMobile = breakpoint === "mobile";
  return (
    <div
      className="relative h-full"
      data-testid="year-panel"
      data-loading={showSkeleton ? true : undefined}
      data-breakpoint={breakpoint}
    >
      {error && <ErrorBanner error={error} />}
      {showSkeleton ? (
        <YearSkeleton />
      ) : (
        <div
          className={isMobile ? "overflow-x-auto" : undefined}
          data-testid="year-view-wrapper"
        >
          <YearView
            data-testid="year-view"
            date={anchor}
            events={scheduleEvents}
            withHeader={false}
          />
        </div>
      )}
    </div>
  );
}
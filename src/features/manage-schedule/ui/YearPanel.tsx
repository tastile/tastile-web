// src/components/schedule/YearPanel.tsx
"use client";

import type { CalendarEvent } from "@/calendar/model/calendar";
import type { DisplayMode, DisplayRange } from "@/lib/calendar/layout";
import { YearView } from "@/lib/vendored/mantine-schedule";
import { cn } from "@/shared/lib/cn";
import { useLayoutEffect, useRef } from "react";
import { ErrorBanner } from "./ErrorBanner";
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
  //
  // Frame-first: the YearView grid is always rendered so the user sees
  // the placement frame at the earliest possible moment. Events populate
  // each day cell as they arrive; an empty events array renders an
  // empty grid (no indicators). This mirrors how MonthPanel renders its
  // grid unconditionally and avoids the spinner/skeleton round-trip.
  const scheduleEvents = events.flatMap(toScheduleEvents);
  const isMobile = breakpoint === "mobile";
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Initialize the months grid scroll to the anchor's month so the user
  // lands on the current month instead of January. Without this the
  // YearView always opens at scrollTop=0 and the user has to scroll
  // manually to find the current month. The grid is the inner
  // `.yearViewMonths` container; we identify it via the custom class
  // applied through `classNames` (months are children in Jan→Dec order).
  useLayoutEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const monthsGrid = wrapper.querySelector<HTMLElement>(".year-view-months");
    if (!monthsGrid) return;
    const monthIndex = Number.parseInt(anchor.slice(5, 7), 10) - 1;
    if (!Number.isFinite(monthIndex) || monthIndex < 0 || monthIndex >= monthsGrid.children.length) {
      return;
    }
    const target = monthsGrid.children.item(monthIndex) as HTMLElement | null;
    if (!target) return;
    monthsGrid.scrollTop = target.offsetTop;
  }, [anchor]);

  return (
    <div
      className="relative h-full"
      data-testid="year-panel"
      data-loading={loading || undefined}
      data-breakpoint={breakpoint}
    >
      {error && <ErrorBanner error={error} />}
      <div
        ref={wrapperRef}
        className={cn("h-full", isMobile && "overflow-x-auto")}
        data-testid="year-view-wrapper"
      >
        <YearView
          classNames={{ yearViewMonths: "year-view-months" }}
          data-testid="year-view"
          date={anchor}
          events={scheduleEvents}
          withHeader={false}
        />
      </div>
    </div>
  );
}
// src/components/schedule/WeekPanel.tsx
"use client";

import type { CalendarEvent } from "@/calendar/model/calendar";
import type { DisplayMode, DisplayRange } from "@/lib/calendar/layout";
import { getWeekViewDates } from "@/lib/calendar/layout";
import { WeekView } from "@/lib/vendored/mantine-schedule";
import { getFirstDayOfWeek, useWeekStartStore } from "@/shared/stores/week-start-store";
import { useEffect, useMemo, useRef } from "react";
import { ErrorBanner } from "./ErrorBanner";
import { buildLoadingWeekEvents, toScheduleEvents } from "./eventAdapter";
import { renderEventBody } from "./renderEventBody";

type Props = {
  range: DisplayRange;
  anchor: string;
  zoom: number;
  displayMode: DisplayMode;
  events: CalendarEvent[];
  loading: boolean;
  error: Error | null;
  onEventClick: (event: CalendarEvent) => void;
  onSlotCreate: (start: string, end: string) => void;
  onZoomBy: (delta: number) => void;
};

/**
 * Always show the full 24h grid. Auto-scroll to the relevant time
 * via startScrollTime instead of trimming the grid (which caused
 * startTime === endTime → empty grid in around/future modes).
 */
function getScrollTimeForMode(mode: DisplayMode): string | undefined {
  if (mode === "scope") return undefined;
  const now = new Date();
  const h = now.getHours();
  return `${String(h).padStart(2, "0")}:00:00`;
}

export function WeekPanel({
  range,
  anchor,
  zoom,
  displayMode,
  events,
  loading,
  error,
  onEventClick,
  onSlotCreate,
  onZoomBy,
}: Props) {
  const weekStartPref = useWeekStartStore((s) => s.weekStart);
  const firstDayOfWeek = getFirstDayOfWeek(weekStartPref);

  // While loading, swap real events for placeholder shells with a
  // sentinel title so the same ScheduleEvent pipeline positions them
  // at realistic times of each day. renderEventBody detects the
  // sentinel and substitutes a Skeleton card of the same shape.
  const loadingEvents = useMemo(
    () => (loading ? buildLoadingWeekEvents(anchor, firstDayOfWeek) : []),
    [loading, anchor, firstDayOfWeek],
  );
  const realScheduleEvents = useMemo(
    () => events.flatMap(toScheduleEvents),
    [events],
  );
  const scheduleEvents = loading ? loadingEvents.flatMap(toScheduleEvents) : realScheduleEvents;

  const containerRef = useRef<HTMLDivElement>(null);
  const onZoomByRef = useRef(onZoomBy);

  useEffect(() => {
    onZoomByRef.current = onZoomBy;
    const el = containerRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      onZoomByRef.current(e.deltaY < 0 ? 1 : -1);
    };
    el.addEventListener("wheel", handler, { passive: false, capture: true });
    return () => {
      el.removeEventListener("wheel", handler, { capture: true });
      onZoomByRef.current = onZoomBy;
    };
  }, [onZoomBy]);

  void range;

  const scrollTime = getScrollTimeForMode(displayMode);
  const weekDates = getWeekViewDates(displayMode, anchor, firstDayOfWeek);

  return (
    <div
      ref={containerRef}
      className="relative h-full"
      data-testid="week-panel"
      data-loading={loading || undefined}
    >
      {error && <ErrorBanner error={error} />}
      <WeekView
        data-testid="week-view"
        date={anchor}
        weekDates={weekDates}
        events={scheduleEvents}
        withHeader={false}
        firstDayOfWeek={firstDayOfWeek}
        withWeekendDays
        canDragEvent={() => false}
        canResizeEvent={() => false}
        withDragSlotSelect
        withCurrentTimeIndicator
        intervalMinutes={60}
        onEventClick={(e) => onEventClick(e.payload as CalendarEvent)}
        onTimeSlotClick={({ slotStart, slotEnd }) => onSlotCreate(slotStart, slotEnd)}
        onSlotDragEnd={(s, e) => onSlotCreate(s, e)}
        renderEventBody={(e) => renderEventBody(e, "week")}
        scrollAreaProps={{ style: { height: "100%" } }}
        startScrollTime={scrollTime}
        style={{ "--week-view-slot-height": `${zoom}px` } as React.CSSProperties}
      />
    </div>
  );
}

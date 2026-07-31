// src/components/schedule/WeekPanel.tsx
"use client";

import type { DisplayMode, DisplayRange } from "@/lib/calendar/layout";
import type { CalendarEvent } from "@/lib/domain/calendar";
import { getFirstDayOfWeek, useWeekStartStore } from "@/lib/stores/week-start-store";
import { WeekView } from "@/lib/vendored/mantine-schedule";
import { useEffect, useRef } from "react";
import { ErrorBanner } from "./ErrorBanner";
import { LoadingOverlay } from "./LoadingOverlay";
import { toScheduleEvents } from "./eventAdapter";
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
  const scheduleEvents = events.flatMap(toScheduleEvents);
  const weekStartPref = useWeekStartStore((s) => s.weekStart);
  const firstDayOfWeek = getFirstDayOfWeek(weekStartPref);

  // Stable onZoomBy ref
  const onZoomByRef = useRef(onZoomBy);
  onZoomByRef.current = onZoomBy;

  // Zoom via Ctrl+wheel — capture phase on container so it fires before ScrollArea
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      onZoomByRef.current(e.deltaY < 0 ? 1 : -1);
    };
    el.addEventListener("wheel", handler, { passive: false, capture: true });
    return () => el.removeEventListener("wheel", handler, { capture: true });
  }, []);

  void range;

  const scrollTime = getScrollTimeForMode(displayMode);

  return (
    <div ref={containerRef} className="relative h-full" data-testid="week-panel">
      {error && <ErrorBanner error={error} />}
      <LoadingOverlay loading={loading}>
        <WeekView
          data-testid="week-view"
          date={anchor}
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
      </LoadingOverlay>
    </div>
  );
}

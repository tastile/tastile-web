// src/components/schedule/DayPanel.tsx
"use client";

import type { DisplayMode, DisplayRange } from "@/lib/calendar/layout";
import type { CalendarEvent } from "@/lib/domain/calendar";
import { DayView, MobileMonthView } from "@/lib/vendored/mantine-schedule";
import type { ScheduleEventData } from "@/lib/vendored/mantine-schedule";
import { useCallback, useEffect, useRef } from "react";
import { ErrorBanner } from "./ErrorBanner";
import { LoadingOverlay } from "./LoadingOverlay";
import { toScheduleEvents } from "./eventAdapter";
import { renderEventBody } from "./renderEventBody";
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
  onSlotCreate: (start: string, end: string) => void;
  onZoomBy: (delta: number) => void;
};

/**
 * Compute the start time for the DayView hour grid based on display mode.
 * - scope: 00:00 (full day from midnight)
 * - around: current hour - 12h (centered on now)
 * - future: current hour (from now forward)
 */
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

export function DayPanel({
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
  const breakpoint = useResponsiveBreakpoint();
  const scheduleEvents = events.flatMap(toScheduleEvents);
  const containerRef = useRef<HTMLDivElement>(null);

  const onZoomByRef = useRef(onZoomBy);
  onZoomByRef.current = onZoomBy;

  // Zoom via Ctrl+wheel — capture phase on container so it fires before ScrollArea
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

  if (breakpoint === "mobile") {
    const renderMobileEvent = (e: ScheduleEventData) => {
      const body = renderEventBody(e as ScheduleEventData<CalendarEvent>, "month");
      // biome-ignore lint/complexity/noUselessFragments: RenderEvent contract requires ReactElement, not null
      return (body as React.ReactElement) ?? <></>;
    };

    return (
      <div className="relative h-full" data-testid="day-panel-mobile">
        {error && <ErrorBanner error={error} />}
        <LoadingOverlay loading={loading}>
          <MobileMonthView
            date={anchor}
            events={scheduleEvents}
            onEventClick={(e) => onEventClick(e.payload as CalendarEvent)}
            renderEvent={renderMobileEvent}
          />
        </LoadingOverlay>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative h-full" data-testid="day-panel">
      {error && <ErrorBanner error={error} />}
      <LoadingOverlay loading={loading}>
        <DayView
          date={anchor}
          events={scheduleEvents}
          withHeader={false}
          canDragEvent={() => false}
          canResizeEvent={() => false}
          withDragSlotSelect
          withCurrentTimeIndicator
          intervalMinutes={30}
          onEventClick={(e) => onEventClick(e.payload as CalendarEvent)}
          onTimeSlotClick={({ slotStart, slotEnd }) => onSlotCreate(slotStart, slotEnd)}
          onSlotDragEnd={(s, e) => onSlotCreate(s, e)}
          renderEventBody={(e) => renderEventBody(e, "day")}
          scrollAreaProps={{ style: { height: "100%" } }}
          startScrollTime={scrollTime}
          style={{ "--day-view-slot-height": `${zoom}px` } as React.CSSProperties}
        />
      </LoadingOverlay>
    </div>
  );
}

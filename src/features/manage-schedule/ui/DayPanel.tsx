// src/components/schedule/DayPanel.tsx
"use client";

import type { CalendarEvent } from "@/calendar/model/calendar";
import type { DisplayMode, DisplayRange } from "@/lib/calendar/layout";
import { getDayViewTimeRange } from "@/lib/calendar/layout";
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
 * Compute the auto-scroll time based on display mode.
 * - scope: no scroll (top of grid = 00:00)
 * - around: scroll to start of visible range (currentHour - 12, clipped)
 * - future: scroll to current hour
 */
function getScrollTimeForMode(mode: DisplayMode): string | undefined {
  if (mode === "scope") return undefined;
  const now = new Date();
  const h = now.getHours();
  if (mode === "around") {
    const scrollH = Math.max(0, h - 12);
    return `${String(scrollH).padStart(2, "0")}:00:00`;
  }
  // future
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

  // Zoom via Ctrl+wheel — capture phase on container so it fires before ScrollArea
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
  const { startTime, endTime } = getDayViewTimeRange(displayMode);

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
          startTime={startTime}
          endTime={endTime}
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

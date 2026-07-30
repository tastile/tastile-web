// src/components/schedule/DayPanel.tsx
"use client";

import type { DisplayRange } from "@/lib/calendar/layout";
import type { CalendarEvent } from "@/lib/domain/calendar";
import { DayView, MobileMonthView } from "@/lib/vendored/mantine-schedule";
import type { ScheduleEventData } from "@/lib/vendored/mantine-schedule";
import { useCallback, useRef } from "react";
import { ErrorBanner } from "./ErrorBanner";
import { LoadingOverlay } from "./LoadingOverlay";
import { toScheduleEvents } from "./eventAdapter";
import { renderEventBody } from "./renderEventBody";
import { useResponsiveBreakpoint } from "./useResponsiveBreakpoint";

type Props = {
  range: DisplayRange;
  anchor: string;
  zoom: number;
  events: CalendarEvent[];
  loading: boolean;
  error: Error | null;
  onEventClick: (event: CalendarEvent) => void;
  onSlotCreate: (start: string, end: string) => void;
  onZoomBy: (delta: number) => void;
};

export function DayPanel({
  range,
  anchor,
  zoom,
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

  // Ctrl+wheel zoom
  const onWheel = useCallback(
    (e: React.WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      onZoomBy(e.deltaY < 0 ? 1 : -1);
    },
    [onZoomBy],
  );

  void range;

  if (breakpoint === "mobile") {
    const renderMobileEvent = (e: ScheduleEventData) => {
      const body = renderEventBody(e as ScheduleEventData<CalendarEvent>, "month");
      // biome-ignore lint/complexity/noUselessFragments: RenderEvent contract requires ReactElement, not null
      return (body as React.ReactElement) ?? <></>;
    };

    return (
      <div className="relative" data-testid="day-panel-mobile">
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
    <div ref={containerRef} className="relative" data-testid="day-panel" onWheel={onWheel}>
      <style>{`:root { --day-view-slot-height: ${zoom}px; }`}</style>
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
        />
      </LoadingOverlay>
    </div>
  );
}

// src/components/schedule/WeekPanel.tsx
"use client";

import type { DisplayRange } from "@/lib/calendar/layout";
import type { CalendarEvent } from "@/lib/domain/calendar";
import { WeekView } from "@/lib/vendored/mantine-schedule";
import { useCallback, useRef } from "react";
import { ErrorBanner } from "./ErrorBanner";
import { LoadingOverlay } from "./LoadingOverlay";
import { toScheduleEvents } from "./eventAdapter";
import { renderEventBody } from "./renderEventBody";

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

export function WeekPanel({
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
  const scheduleEvents = events.flatMap(toScheduleEvents);
  const containerRef = useRef<HTMLDivElement>(null);

  const onWheel = useCallback(
    (e: React.WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      onZoomBy(e.deltaY < 0 ? 1 : -1);
    },
    [onZoomBy],
  );

  void range;

  return (
    <div ref={containerRef} className="relative" data-testid="week-panel" onWheel={onWheel}>
      <style>{`:root { --week-view-slot-height: ${zoom}px; }`}</style>
      {error && <ErrorBanner error={error} />}
      <LoadingOverlay loading={loading}>
        <WeekView
          data-testid="week-view"
          date={anchor}
          events={scheduleEvents}
          withHeader={false}
          firstDayOfWeek={1}
          withWeekendDays
          canDragEvent={() => false}
          canResizeEvent={() => false}
          withDragSlotSelect
          withCurrentTimeIndicator
          intervalMinutes={60}
          startTime="00:00:00"
          endTime="23:59:59"
          onEventClick={(e) => onEventClick(e.payload as CalendarEvent)}
          onTimeSlotClick={({ slotStart, slotEnd }) => onSlotCreate(slotStart, slotEnd)}
          onSlotDragEnd={(s, e) => onSlotCreate(s, e)}
          renderEventBody={(e) => renderEventBody(e, "week")}
        />
      </LoadingOverlay>
    </div>
  );
}

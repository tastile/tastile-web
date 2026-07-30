// src/components/schedule/DayPanel.tsx
"use client";

import { DayView, MobileMonthView } from "@mantine/schedule";
import type { ScheduleEventData } from "@mantine/schedule";
import type { CalendarEvent } from "@/lib/domain/calendar";
import type { DisplayRange } from "@/lib/calendar/layout";
import { toScheduleEvent } from "./eventAdapter";
import { renderEventBody } from "./renderEventBody";
import { useResponsiveBreakpoint } from "./useResponsiveBreakpoint";
import { LoadingOverlay } from "./LoadingOverlay";
import { ErrorBanner } from "./ErrorBanner";

type Props = {
  range: DisplayRange;
  anchor: string;
  zoom: number;
  events: CalendarEvent[];
  loading: boolean;
  error: Error | null;
  onEventClick: (event: CalendarEvent) => void;
  onSlotCreate: (start: string, end: string) => void;
};

export function DayPanel({
  range, anchor, zoom, events, loading, error, onEventClick, onSlotCreate,
}: Props) {
  const breakpoint = useResponsiveBreakpoint();
  const scheduleEvents = events.map(toScheduleEvent);

  if (breakpoint === "mobile") {
    return (
      <div className="relative" data-testid="day-panel-mobile">
        {error && <ErrorBanner error={error} />}
        <LoadingOverlay loading={loading}>
          <MobileMonthView
            date={anchor}
            events={scheduleEvents}
            onEventClick={(e) => onEventClick(e.payload as CalendarEvent)}
            renderEvent={(e) => renderEventBody(e as ScheduleEventData<CalendarEvent>, "month") ?? <></>}
          />
        </LoadingOverlay>
      </div>
    );
  }

  return (
    <div className="relative" data-testid="day-panel">
      <style>{`:root { --day-view-slot-height: ${zoom}px; }`}</style>
      {error && <ErrorBanner error={error} />}
      <LoadingOverlay loading={loading}>
        <DayView
          date={anchor}
          events={scheduleEvents}
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

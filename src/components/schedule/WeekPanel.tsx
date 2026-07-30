// src/components/schedule/WeekPanel.tsx
"use client";

import { WeekView } from "@mantine/schedule";
import type { CalendarEvent } from "@/lib/domain/calendar";
import type { DisplayRange } from "@/lib/calendar/layout";
import { toScheduleEvent } from "./eventAdapter";
import { renderEventBody } from "./renderEventBody";
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

export function WeekPanel({
  range, anchor, zoom, events, loading, error, onEventClick, onSlotCreate,
}: Props) {
  const scheduleEvents = events.map(toScheduleEvent);
  return (
    <div className="relative" data-testid="week-panel">
      <style>{`:root { --week-view-slot-height: ${zoom}px; }`}</style>
      {error && <ErrorBanner error={error} />}
      <LoadingOverlay loading={loading}>
        <WeekView
          data-testid="week-view"
          date={anchor}
          events={scheduleEvents}
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

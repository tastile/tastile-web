"use client";

import { MonthView } from "@mantine/schedule";
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
  onDayClick: (date: string) => void;
};

export function MonthPanel({
  range, anchor, zoom, events, loading, error, onEventClick, onSlotCreate, onDayClick,
}: Props) {
  const scheduleEvents = events.map(toScheduleEvent);
  return (
    <div className="relative" data-testid="month-panel">
      {error && <ErrorBanner error={error} />}
      <LoadingOverlay loading={loading}>
        <MonthView
          data-testid="month-view"
          date={anchor}
          events={scheduleEvents}
          firstDayOfWeek={1}
          withWeekendDays
          maxEventsPerDay={3}
          withOutsideDays
          canDragEvent={() => false}
          withDragSlotSelect
          onEventClick={(e) => onEventClick(e.payload as CalendarEvent)}
          onDayClick={onDayClick}
          onSlotDragEnd={(s, e) => onSlotCreate(s, e)}
          renderEventBody={(e) => renderEventBody(e, "month")}
        />
      </LoadingOverlay>
    </div>
  );
}

// src/components/schedule/MonthPanel.tsx
"use client";

import type { CalendarEvent } from "@/calendar/model/calendar";
import type { DisplayMode, DisplayRange } from "@/lib/calendar/layout";
import { MonthView } from "@/lib/vendored/mantine-schedule";
import { getFirstDayOfWeek, useWeekStartStore } from "@/shared/stores/week-start-store";
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
  onDayClick: (date: string) => void;
};

export function MonthPanel({
  range,
  anchor,
  zoom,
  displayMode,
  events,
  loading,
  error,
  onEventClick,
  onSlotCreate,
  onDayClick,
}: Props) {
  const scheduleEvents = events.flatMap(toScheduleEvents);
  const weekStartPref = useWeekStartStore((s) => s.weekStart);
  const firstDayOfWeek = getFirstDayOfWeek(weekStartPref);

  void zoom;
  void displayMode;
  void range;

  return (
    <div className="relative h-full" data-testid="month-panel">
      {error && <ErrorBanner error={error} />}
      <LoadingOverlay loading={loading}>
        <MonthView
          data-testid="month-view"
          date={anchor}
          events={scheduleEvents}
          withHeader={false}
          firstDayOfWeek={firstDayOfWeek}
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

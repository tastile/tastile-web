// src/components/schedule/YearPanel.tsx
"use client";

import type { DisplayMode, DisplayRange } from "@/lib/calendar/layout";
import type { CalendarEvent } from "@/lib/domain/calendar";
import { YearView } from "@/lib/vendored/mantine-schedule";
import { ErrorBanner } from "./ErrorBanner";
import { LoadingOverlay } from "./LoadingOverlay";
import { toScheduleEvents } from "./eventAdapter";

type Props = {
  range: DisplayRange;
  anchor: string;
  zoom: number;
  displayMode: DisplayMode;
  events: CalendarEvent[];
  loading: boolean;
  error: Error | null;
  onEventClick: (event: CalendarEvent) => void;
};

export function YearPanel({ range, anchor, zoom, displayMode, events, loading, error }: Props) {
  void range;
  void zoom;
  void displayMode;
  // YearView in @/lib/vendored/mantine-schedule does not expose renderEventBody or
  // onEventClick — it renders each day's events as up to 3 colored
  // indicator dots. Props that do not apply to this view (zoom, range,
  // onEventClick) are kept in the type contract for parity with the
  // other panels but ignored here.
  void range;
  void zoom;
  const scheduleEvents = events.flatMap(toScheduleEvents);
  return (
    <div className="relative h-full" data-testid="year-panel">
      {error && <ErrorBanner error={error} />}
      <LoadingOverlay loading={loading}>
        <YearView
          data-testid="year-view"
          date={anchor}
          events={scheduleEvents}
          withHeader={false}
        />
      </LoadingOverlay>
    </div>
  );
}

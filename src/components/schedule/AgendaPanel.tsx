// src/components/schedule/AgendaPanel.tsx
"use client";

import type { DisplayRange } from "@/lib/calendar/layout";
import type { CalendarEvent } from "@/lib/domain/calendar";
import { AgendaView } from "@mantine/schedule";
import type { ScheduleEventData } from "@mantine/schedule";
import { ErrorBanner } from "./ErrorBanner";
import { LoadingOverlay } from "./LoadingOverlay";
import { toScheduleEvent } from "./eventAdapter";
import { renderEventBody } from "./renderEventBody";

type Props = {
  range: DisplayRange;
  anchor: string;
  zoom: number;
  events: CalendarEvent[];
  loading: boolean;
  error: Error | null;
  onEventClick: (event: CalendarEvent) => void;
};

// AgendaView's natural window spans 30 days from the anchor.
// Tuned for the typical "list upcoming" use case without scrolling far.
const AGENDA_WINDOW_DAYS = 30;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function AgendaPanel({ range, anchor, zoom, events, loading, error, onEventClick }: Props) {
  void range;
  void zoom;
  const scheduleEvents = events.map(toScheduleEvent);
  const rangeStart = new Date(anchor);
  const rangeEnd = new Date(rangeStart.getTime() + AGENDA_WINDOW_DAYS * MS_PER_DAY);
  return (
    <div className="relative" data-testid="agenda-panel">
      {error && <ErrorBanner error={error} />}
      <LoadingOverlay loading={loading}>
        <AgendaView
          data-testid="agenda-view"
          rangeStart={rangeStart}
          rangeEnd={rangeEnd}
          events={scheduleEvents}
          onEventClick={(e) => onEventClick(e.payload as CalendarEvent)}
          renderEvent={(e, props) => (
            <button {...props}>
              {renderEventBody(e as ScheduleEventData<CalendarEvent>, "agenda")}
            </button>
          )}
        />
      </LoadingOverlay>
    </div>
  );
}

// src/components/schedule/AgendaPanel.tsx
"use client";

import type { CalendarEvent } from "@/calendar/model/calendar";
import type { DisplayMode, DisplayRange } from "@/lib/calendar/layout";
import { AgendaView } from "@/lib/vendored/mantine-schedule";
import type { ScheduleEventData } from "@/lib/vendored/mantine-schedule";
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
};

const AGENDA_WINDOW_DAYS = 30;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function AgendaPanel({
  range,
  anchor,
  zoom,
  displayMode,
  events,
  loading,
  error,
  onEventClick,
}: Props) {
  void zoom;
  void displayMode;
  void range;
  const scheduleEvents = events.flatMap(toScheduleEvents);
  const rangeStart = new Date(`${anchor}T00:00:00Z`);
  const rangeEnd = new Date(rangeStart.getTime() + AGENDA_WINDOW_DAYS * MS_PER_DAY);
  return (
    <div className="relative h-full" data-testid="agenda-panel">
      {error && <ErrorBanner error={error} />}
      <LoadingOverlay loading={loading} view="agenda">
        <AgendaView
          data-testid="agenda-view"
          rangeStart={rangeStart}
          rangeEnd={rangeEnd}
          events={scheduleEvents}
          onEventClick={(e) => onEventClick(e.payload as CalendarEvent)}
          renderEvent={(e, props) => (
            <button
              {...props}
              className="group flex w-full items-center gap-3 rounded-lg border border-transparent px-3 py-2.5 text-left transition-colors hover:border-[var(--agenda-view-border-color)] hover:bg-[var(--mantine-color-gray-0)] dark:hover:bg-[var(--mantine-color-dark-6)]"
            >
              <div
                className="h-8 w-1 shrink-0 rounded-full"
                style={{ backgroundColor: e.color ?? "var(--mantine-color-blue-5)" }}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  {renderEventBody(e as ScheduleEventData<CalendarEvent>, "agenda")}
                </div>
                <p className="mt-0.5 text-[11px] text-[var(--mantine-color-dimmed)]">
                  {formatTimeRange(e.start, e.end)}
                </p>
              </div>
            </button>
          )}
        />
      </LoadingOverlay>
    </div>
  );
}

function formatTimeRange(start: Date | string, end: Date | string): string {
  const s = new Date(start);
  const e = new Date(end);
  const fmt = (d: Date) =>
    d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
  return `${fmt(s)} – ${fmt(e)}`;
}

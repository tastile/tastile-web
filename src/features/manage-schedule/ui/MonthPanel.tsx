// src/components/schedule/MonthPanel.tsx
"use client";

import type { CalendarEvent } from "@/calendar/model/calendar";
import type { DisplayMode, DisplayRange } from "@/lib/calendar/layout";
import { MonthView } from "@/lib/vendored/mantine-schedule";
import { getFirstDayOfWeek, useWeekStartStore } from "@/shared/stores/week-start-store";
import dayjs from "dayjs";
import { useMemo } from "react";
import { ErrorBanner } from "./ErrorBanner";
import { MONTH_LOADING_CHIPS_PER_CELL, toScheduleEvents } from "./eventAdapter";
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

/** Build the 42 cell dates (6 weeks × 7 days) the Month grid renders.
 *  Mirrors the same padding as `getMonthViewDates` so the skeleton
 *  occupies exactly the cells the user can see. */
function getMonthCellDates(anchor: string, firstDayOfWeek: 0 | 1): string[] {
  const d = dayjs(anchor);
  if (!d.isValid()) return [];
  const startOfMonth = d.startOf("month");
  const dow = startOfMonth.day();
  const offset = (dow - firstDayOfWeek + 7) % 7;
  const gridStart = startOfMonth.subtract(offset, "day");
  const out: string[] = [];
  for (let i = 0; i < 42; i += 1) {
    out.push(gridStart.add(i, "day").format("YYYY-MM-DD"));
  }
  return out;
}

/** Build a single placeholder event whose start/end sit inside the
 *  top slot of `cellDate`. Each slot is 1h wide; the cell renders
 *  them in event-start order, so the chip appears at the top. */
function loadingEventForCell(cellDate: string, chipIndex: number): CalendarEvent {
  const start = dayjs(`${cellDate}T00:00:00`).add(chipIndex, "hour");
  const end = start.add(30, "minute");
  return {
    id: `__loading_month_${cellDate}_${chipIndex}`,
    title: "__loading__",
    start: start.toISOString(),
    end: end.toISOString(),
    allDay: false,
    color: "gray",
    recurrence: { frequency: "none" },
    createdAt: "",
    updatedAt: "",
  };
}

/** YYYY-MM-DD of the local day an event starts on. Used to mark
 *  which cells already have real events so we don't stack a skeleton
 *  chip on top of a real one. */
function eventLocalDate(iso: string): string {
  return iso.slice(0, 10);
}

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
  const weekStartPref = useWeekStartStore((s) => s.weekStart);
  const firstDayOfWeek = getFirstDayOfWeek(weekStartPref);

  void zoom;
  void displayMode;
  void range;

  // Compose the displayed event list:
  //   1. real events (always),
  //   2. while loading, N skeleton chips per cell that has NO real
  //      events on it.
  // Skeletons render in real-event order with the chips laid down
  // FIRST for any still-empty cell, so each chip occupies the exact
  // slot a real card would. As chunks arrive, real events push
  // skeletons out of the cell without changing the slot count.
  const displayEvents = useMemo<CalendarEvent[]>(() => {
    if (events.length > 0 && !loading) {
      return events;
    }
    const out: CalendarEvent[] = [];
    if (events.length > 0) {
      for (const ev of events) out.push(ev);
    }
    if (loading) {
      const cellDates = getMonthCellDates(anchor, firstDayOfWeek);
      const realByCell = new Set<string>();
      for (const ev of events) {
        const start = eventLocalDate(ev.start);
        // For all-day events whose end sits at midnight of the next day,
        // count the cell under the event's last visible day, not the
        // day *after*. The upstream uses exclusive end-of-day for
        // all-day events.
        let end = eventLocalDate(ev.end);
        if (ev.allDay && end !== start && end !== "") {
          const ed = dayjs(end);
          if (ed.hour() === 0 && ed.minute() === 0 && ed.second() === 0) {
            end = ed.subtract(1, "day").format("YYYY-MM-DD");
          }
        }
        let cursor = dayjs(start);
        const stop = dayjs(end);
        while (cursor.isSame(stop) || cursor.isBefore(stop)) {
          realByCell.add(cursor.format("YYYY-MM-DD"));
          cursor = cursor.add(1, "day");
        }
      }
      for (const cellDate of cellDates) {
        if (realByCell.has(cellDate)) continue;
        for (let i = 0; i < MONTH_LOADING_CHIPS_PER_CELL; i += 1) {
          out.push(loadingEventForCell(cellDate, i));
        }
      }
    }
    return out;
  }, [events, loading, anchor, firstDayOfWeek]);

  const scheduleEvents = displayEvents.flatMap(toScheduleEvents);

  return (
    <div
      className="relative h-full"
      data-testid="month-panel"
      data-loading={loading || undefined}
    >
      {error && <ErrorBanner error={error} />}
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
    </div>
  );
}

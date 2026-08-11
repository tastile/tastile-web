// src/components/schedule/MonthPanel.tsx
"use client";

import type { CalendarEvent } from "@/calendar/model/calendar";
import type { DisplayMode, DisplayRange } from "@/lib/calendar/layout";
import { MonthView } from "@/lib/vendored/mantine-schedule";
import { getFirstDayOfWeek, useWeekStartStore } from "@/shared/stores/week-start-store";
import dayjs from "dayjs";
import { useMemo } from "react";
import { ErrorBanner } from "./ErrorBanner";
import {
  MONTH_LOADING_CHIPS_PER_CELL,
  MONTH_LOADING_EVENT_TITLE,
  toScheduleEvents,
} from "./eventAdapter";
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

/**
 * Build the 42-cell `YYYY-MM-DD` grid that MonthView will render for
 * `anchor` given `firstDayOfWeek`. Mirrors the layout vendored
 * `getMonthDays` produces (consistentWeeks=true, withOutsideDays=true):
 *   - start of grid = first day of `anchor`'s month, snapped back to
 *     `firstDayOfWeek`
 *   - 42 consecutive days (6 rows × 7 columns)
 *
 * The cells are returned in left-to-right, top-to-bottom order so they
 * line up 1:1 with MonthView's own `getMonthViewEvents` grouping.
 */
function getMonthCellDates(anchor: string, firstDayOfWeek: number): string[] {
  const monthStart = dayjs(anchor).startOf("month");
  const firstDayOfMonth = monthStart.day();
  const offset = (firstDayOfMonth - firstDayOfWeek + 7) % 7;
  let cursor = monthStart.subtract(offset, "day");
  const dates: string[] = [];
  for (let i = 0; i < 42; i += 1) {
    dates.push(cursor.format("YYYY-MM-DD"));
    cursor = cursor.add(1, "day");
  }
  return dates;
}

/**
 * Convert an ISO instant to a local-time `YYYY-MM-DD` so it can be
 * matched against the cell-date strings `getMonthCellDates` returns.
 * Dayjs's `format("YYYY-MM-DD")` always uses local time, which is
 * what the MonthView grid is keyed on.
 */
function eventLocalDate(iso: string): string {
  return dayjs(iso).format("YYYY-MM-DD");
}

/** Build a single placeholder event whose date covers `cellDate`. */
function loadingEventForCell(cellDate: string, chipIndex: number): CalendarEvent {
  const next = dayjs(cellDate).add(1, "day").format("YYYY-MM-DD");
  return {
    id: `__loading_${cellDate}_${chipIndex}`,
    title: MONTH_LOADING_EVENT_TITLE,
    start: `${cellDate}T00:00:00.000Z`,
    end: `${next}T00:00:00.000Z`,
    allDay: true,
    color: "gray",
    recurrence: { frequency: "none" },
    createdAt: "",
    updatedAt: "",
  };
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

  /**
   * Per-cell composition: for each of the 42 visible cells, decide
   * whether to render real events, skeleton chips, or nothing.
   *
   *   cell has real data → push the events once (toScheduleEvents
   *     later splits multi-day events into one ScheduleEventData per
   *     day, so we never push the same CalendarEvent twice)
   *   cell has no real data AND loading=true → push skeleton chips
   *     so the user can see this cell is still pending
   *   cell has no real data AND loading=false → leave it empty; the
   *     user knows this is a genuinely empty day, not a still-loading
   *     one
   *
   * This makes the skeleton's disappearance timing match the data
   * arrival: as `useEvents` merges each chunk into state, the cells
   * covered by that chunk switch from skeleton to real events.
   * Without this, skeletons would vanish in one shot when the first
   * chunk arrives while the rest of the month is still loading
   * without any signal.
   */
  const displayEvents = useMemo(() => {
    const cellDates = getMonthCellDates(anchor, firstDayOfWeek);
    const realByCell = new Map<string, true>();
    for (const ev of events) {
      const start = dayjs(ev.start).startOf("day");
      const rawEnd = dayjs(ev.end);
      const endAtMidnight = rawEnd.hour() === 0 && rawEnd.minute() === 0 && rawEnd.second() === 0;
      const end = (ev.allDay && endAtMidnight ? rawEnd.subtract(1, "day") : rawEnd).startOf("day");
      let cursor = start;
      while (cursor.isSame(end) || cursor.isBefore(end)) {
        realByCell.set(cursor.format("YYYY-MM-DD"), true);
        cursor = cursor.add(1, "day");
      }
    }
    const display: CalendarEvent[] = [];
    if (realByCell.size > 0) {
      // Push every event exactly once. toScheduleEvents will produce
      // one ScheduleEventData per day the event spans.
      for (const ev of events) display.push(ev);
    }
    if (loading) {
      for (const cellDate of cellDates) {
        if (realByCell.has(cellDate)) continue;
        for (let i = 0; i < MONTH_LOADING_CHIPS_PER_CELL; i += 1) {
          display.push(loadingEventForCell(cellDate, i));
        }
      }
    }
    return display;
  }, [events, loading, anchor, firstDayOfWeek]);

  const scheduleEvents = displayEvents.flatMap(toScheduleEvents);

  void zoom;
  void displayMode;
  void range;

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

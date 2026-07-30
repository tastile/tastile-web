import type { CalendarEvent, EventColor } from "@/lib/domain/calendar";
// src/components/schedule/eventAdapter.ts
import type { ScheduleEventData } from "@/lib/vendored/mantine-schedule";

const COLOR_MAP: Record<EventColor, string> = {
  blue: "blue",
  green: "teal",
  purple: "grape",
  orange: "orange",
  pink: "pink",
  cyan: "cyan",
  yellow: "yellow",
  red: "red",
  teal: "teal",
  indigo: "indigo",
  lime: "lime",
  gray: "gray",
};

export function colorToMantine(c: EventColor): string {
  return COLOR_MAP[c] ?? "blue";
}

/**
 * Convert a single CalendarEvent into one or more Mantine ScheduleEventData
 * entries. Overnight events (spanning midnight in local time) are split at
 * day boundaries so Mantine's WeekView/MonthView don't classify them as
 * multi-day → all-day.
 */
export function toScheduleEvents(e: CalendarEvent): ScheduleEventData<CalendarEvent>[] {
  if (e.allDay) {
    return [
      {
        id: e.id,
        title: e.title,
        start: e.start.slice(0, 10) as ScheduleEventData["start"],
        end: e.end.slice(0, 10) as ScheduleEventData["end"],
        color: colorToMantine(e.color),
        variant: "light",
        display: "default",
        payload: e,
      },
    ];
  }

  const startDate = new Date(e.start);
  const endDate = new Date(e.end);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return [];
  }

  const pad = (n: number) => String(n).padStart(2, "0");
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

  // Same day in local time — single event
  if (
    startDate.getFullYear() === endDate.getFullYear() &&
    startDate.getMonth() === endDate.getMonth() &&
    startDate.getDate() === endDate.getDate()
  ) {
    return [
      {
        id: e.id,
        title: e.title,
        start: fmt(startDate) as ScheduleEventData["start"],
        end: fmt(endDate) as ScheduleEventData["end"],
        color: colorToMantine(e.color),
        variant: "light",
        display: "default",
        payload: e,
      },
    ];
  }

  // Overnight event: split at each midnight boundary between start and end
  const results: ScheduleEventData<CalendarEvent>[] = [];
  let current = new Date(startDate);
  let segmentIndex = 0;

  while (current < endDate) {
    // End of this segment = 23:59:59 of current day, clamped to actual endDate
    const dayEnd = new Date(current);
    dayEnd.setHours(23, 59, 59, 999);
    const segmentEnd = dayEnd < endDate ? dayEnd : endDate;

    const segStart = new Date(current);
    results.push({
      id: `${e.id}_d${segmentIndex}`,
      title: e.title,
      start: fmt(segStart) as ScheduleEventData["start"],
      end: fmt(segmentEnd) as ScheduleEventData["end"],
      color: colorToMantine(e.color),
      variant: "light",
      display: "default",
      payload: e,
    });

    // Next segment starts at 00:00:00 of the next day
    current = new Date(dayEnd);
    current.setHours(0, 0, 0, 0);
    current.setDate(current.getDate() + 1);
    segmentIndex++;
  }

  return results;
}

/** @deprecated — use toScheduleEvents for overnight-safe conversion */
function toScheduleEvent(e: CalendarEvent): ScheduleEventData<CalendarEvent> {
  return (
    toScheduleEvents(e)[0] ?? {
      id: e.id,
      title: e.title,
      start: e.start.slice(0, 10) as ScheduleEventData["start"],
      end: e.end.slice(0, 10) as ScheduleEventData["end"],
      color: colorToMantine(e.color),
      variant: "light",
      display: "default",
      payload: e,
    }
  );
}

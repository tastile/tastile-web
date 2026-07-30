import type { CalendarEvent, EventColor } from "@/lib/domain/calendar";
// src/components/schedule/eventAdapter.ts
import type { ScheduleEventData } from "@mantine/schedule";

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

export function toScheduleEvent(e: CalendarEvent): ScheduleEventData<CalendarEvent> {
  return {
    id: e.id,
    title: e.title,
    // For all-day events: pass YYYY-MM-DD date strings (Mantine infers all-day).
    // For timed events: pass YYYY-MM-DD HH:mm:ss datetime strings so Mantine's
    // isAllDayEvent() never falsely matches (it checks start===00:00:00 && end===23:59:59).
    start: e.allDay ? (e.start.slice(0, 10) as ScheduleEventData["start"]) : toDateTimeString(e.start),
    end: e.allDay ? (e.end.slice(0, 10) as ScheduleEventData["end"]) : toDateTimeString(e.end),
    color: colorToMantine(e.color),
    variant: "light",
    display: "default",
    payload: e,
  };
}

/**
 * Convert an ISO 8601 timestamp to a Mantine DateTimeStringValue
 * (YYYY-MM-DD HH:mm:ss). We do NOT use `new Date(s).toISOString().replace('T',' ')`
 * because that would stay in UTC; Mantine's dayjs parser interprets
 * `YYYY-MM-DD HH:mm:ss` in the browser's local timezone, which is what we want.
 */
function toDateTimeString(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

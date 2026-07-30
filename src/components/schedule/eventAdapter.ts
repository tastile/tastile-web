// src/components/schedule/eventAdapter.ts
import type { ScheduleEventData } from "@mantine/schedule";
import type { CalendarEvent, EventColor } from "@/lib/domain/calendar";

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
    // Mantine infers all-day events from YYYY-MM-DD date strings vs Date objects
    start: e.allDay ? (e.start.slice(0, 10) as ScheduleEventData["start"]) : new Date(e.start),
    end: e.allDay ? (e.end.slice(0, 10) as ScheduleEventData["end"]) : new Date(e.end),
    color: colorToMantine(e.color),
    variant: "light",
    display: "default",
    payload: e,
  };
}

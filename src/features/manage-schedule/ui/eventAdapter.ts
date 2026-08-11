import type { CalendarEvent, EventColor } from "@/calendar/model/calendar";
// src/components/schedule/eventAdapter.ts
import type { ScheduleEventData } from "@/lib/vendored/mantine-schedule";
import type { DisplayMode } from "@/lib/calendar/layout";
import dayjs from "dayjs";

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

/**
 * Loading placeholder events render uniformly across every visible cell
 * (day/week/month) so the user can distinguish "still loading" from
 * "loaded, just empty": any empty cell unambiguously means data has
 * arrived. The placeholders flow through the same ScheduleEvent
 * pipeline as real events, so each chip occupies the same size and
 * position as the real card it previews.
 *
 * The "sentinel" trick: every placeholder carries `title =
 * MONTH_LOADING_EVENT_TITLE` so `renderEventBody` can detect it and
 * substitute a Skeleton card of the same shape without learning a new
 * field. The real CalendarEvent payload is preserved so payload-based
 * code paths (e.g. onEventClick) keep working — the skeleton event is
 * never user-clickable in practice (its title is not a real event).
 */

/** Fixed number of placeholder chips per Month cell, regardless of day.
 *  Rendered at the first N row slots inside each cell. Chosen as 2
 *  because real Month renders up to `maxEventsPerDay` (=3) chips per
 *  cell, so 2 is a representative preview without exceeding the cap. */
export const MONTH_LOADING_CHIPS_PER_CELL = 2;

/** Fixed number of placeholder events per Week-view day, each at the
 *  same set of representative hours. Same reasoning as Month: uniform
 *  across days so an empty day after load can't be confused with a
 *  still-loading day. */
const WEEK_LOADING_EVENTS_PER_DAY = 2;

/** Hours of the day (local time) at which a placeholder event starts
 *  inside each Day view. Each event spans `durHours` after the start.
 *  The same set of times is used for both Day and Week views so the
 *  loading preview looks identical across them.
 *
 *  Day view uses all of these at the anchor date.
 *  Week view uses the FIRST N (WEEK_LOADING_EVENTS_PER_DAY) at every
 *  visible day, uniformly. */
type LoadingTime = readonly [startHour: number, durationHours: number];
const LOADING_TIMES: readonly LoadingTime[] = [
  [9, 1.5], // morning work block
  [13, 1], // lunch meeting
  [14.5, 2], // afternoon deep-work block
  [17, 1], // end-of-day wrap
  [19, 1.5], // evening session
];

/** Sentinel title used by every loading placeholder. `renderEventBody`
 *  checks for this title and renders a Mantine Skeleton card of the
 *  same shape instead of the regular event body. */
export const MONTH_LOADING_EVENT_TITLE = "__loading__";

/** Build a synthetic CalendarEvent whose `title` matches the loading
 *  sentinel. Caller is responsible for setting `start`/`end` to the
 *  window the event should occupy; `toScheduleEvents` will then route
 *  the event through the normal ScheduleEvent pipeline. */
function makeLoadingEvent(id: string, start: string, end: string): CalendarEvent {
  return {
    id,
    title: MONTH_LOADING_EVENT_TITLE,
    start,
    end,
    allDay: false,
    color: "gray",
    recurrence: { frequency: "none" },
    createdAt: "",
    updatedAt: "",
  };
}

/**
 * Build placeholder events for the Day view at typical hours of
 * `anchor`'s day. `shiftMs` mirrors the DayView's virtual-time origin
 * shift so placeholders align with the displayed row positions in
 * around/future modes.
 */
export function buildLoadingDayEvents(anchor: string, shiftMs = 0): CalendarEvent[] {
  const base = dayjs(anchor).startOf("day");
  return LOADING_TIMES.map(([hour, dur], i) => {
    const start = base.hour(Math.floor(hour)).minute(Math.round((hour % 1) * 60));
    const end = start.add(Math.round(dur * 60), "minute");
    const startStr = new Date(start.toDate().getTime() + shiftMs).toISOString();
    const endStr = new Date(end.toDate().getTime() + shiftMs).toISOString();
    return makeLoadingEvent(`__loading_day_${i}_${start.valueOf()}`, startStr, endStr);
  });
}

/**
 * Build placeholder events for the Week view. `displayMode` controls
 * which 7 dates the placeholders populate:
 *   - "scope"   : Sun..Sat of anchor's week (existing behavior).
 *   - "around"  : today-3..today+3 (matches the rendered grid).
 *   - "future"  : today..today+6 (matches the rendered grid).
 *
 * Every visible day gets the SAME set of placeholder events at the
 * same times, so the user can tell at a glance that the view is still
 * loading (uniform pattern across all 7 columns) versus a day that
 * has genuinely no events (column stays empty after load).
 */
export function buildLoadingWeekEvents(
  anchor: string,
  firstDayOfWeek: 0 | 1,
  displayMode: DisplayMode = "scope",
): CalendarEvent[] {
  // Resolve the 7 dates the rendered grid actually shows. Re-use the
  // same logic as `getWeekViewDates` so skeleton and grid never drift
  // apart.
  const dates: string[] = (() => {
    const [y, m, d] = anchor.split("-").map(Number);
    const yy = y ?? 1970;
    const mm = (m ?? 1) - 1;
    const dd = d ?? 1;
    if (displayMode === "around") {
      return Array.from({ length: 7 }, (_, i) => {
        const day = new Date(Date.UTC(yy, mm, dd - 3 + i));
        return day.toISOString().slice(0, 10);
      });
    }
    if (displayMode === "future") {
      return Array.from({ length: 7 }, (_, i) => {
        const day = new Date(Date.UTC(yy, mm, dd + i));
        return day.toISOString().slice(0, 10);
      });
    }
    const dow = new Date(Date.UTC(yy, mm, dd)).getUTCDay();
    const offset = (dow - firstDayOfWeek + 7) % 7;
    return Array.from({ length: 7 }, (_, i) => {
      const day = new Date(Date.UTC(yy, mm, dd - offset + i));
      return day.toISOString().slice(0, 10);
    });
  })();

  const events: CalendarEvent[] = [];
  for (let dayOffset = 0; dayOffset < dates.length; dayOffset += 1) {
    const day = dayjs(dates[dayOffset]);
    for (let i = 0; i < WEEK_LOADING_EVENTS_PER_DAY; i += 1) {
      const [hour, dur] = LOADING_TIMES[i];
      const start = day.hour(Math.floor(hour)).minute(Math.round((hour % 1) * 60));
      const end = start.add(Math.round(dur * 60), "minute");
      events.push(
        makeLoadingEvent(
          `__loading_week_d${dayOffset}_${i}_${start.valueOf()}`,
          start.toISOString(),
          end.toISOString(),
        ),
      );
    }
  }
  return events;
}

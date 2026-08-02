import dayjs from "dayjs";
import type { AnyDateValue, DayPositionedEventData, ScheduleEventData } from "../../../types";
import { getDayPosition, isAllDayEvent, isEventInTimeRange, validateEvent } from "../../../utils";
import { getDayPositionedEvents } from "./get-day-positioned-events";

interface GetDayViewEventsInput {
  events: ScheduleEventData[] | undefined;
  date: AnyDateValue;
  startTime?: string;
  endTime?: string;
  intervalMinutes?: number;
  /**
   * When the grid wraps past midnight (e.g. around mode shows 02:00–14:00
   * where 14:00 is next-day), set this to the *actual* start-of-grid instant.
   * Events from adjacent days that fall inside the visible time window will
   * be included and positioned correctly.
   */
  gridRefDate?: AnyDateValue;
}

/**
 * Return true when `startTime`–`endTime` wraps past midnight
 * (i.e. endHour <= startHour).
 */
function gridWrapsMidnight(startTime?: string, endTime?: string): boolean {
  if (!startTime || !endTime) return false;
  const [sh] = startTime.split(":").map(Number);
  const [eh] = endTime.split(":").map(Number);
  return eh <= sh;
}

export function getDayViewEvents({
  events,
  date,
  startTime,
  endTime,
  intervalMinutes,
  gridRefDate,
}: GetDayViewEventsInput) {
  if (events === undefined) {
    return {
      allDayEvents: [],
      regularEvents: [],
      backgroundTimedEvents: [],
      backgroundAllDayEvents: [],
    };
  }

  const ids = new Set<string | number>();
  const filteredEvents: ScheduleEventData[] = [];
  const backgroundFiltered: ScheduleEventData[] = [];
  const dayStart = dayjs(date).startOf("day");
  const dayEnd = dayjs(date).endOf("day");

  const wraps = gridWrapsMidnight(startTime, endTime);

  // When wrapping past midnight, events from the previous day should also
  // appear (e.g. around at 01:00 → grid 13:00 yesterday – 13:00 today).
  const prevDayStart = dayStart.subtract(1, "day");
  const nextDayStart = dayStart.add(1, "day");

  for (const event of events) {
    const eventStart = dayjs(event.start);
    const eventEnd = dayjs(event.end);

    const isOnDay = eventStart.isSame(dayStart, "day");
    const isOnPrevDay = wraps && eventStart.isSame(prevDayStart, "day");
    const isOnNextDay = wraps && eventStart.isSame(nextDayStart, "day");

    const spansIntoDay =
      !isOnDay &&
      event.display === "background" &&
      eventStart.isBefore(dayEnd) &&
      eventEnd.isAfter(dayStart);

    if (isOnDay || isOnPrevDay || isOnNextDay || spansIntoDay) {
      if (
        (isOnDay || isOnPrevDay || isOnNextDay) &&
        !isEventInTimeRange({ event, startTime, endTime })
      ) {
        continue;
      }

      // Normalise cross-day events so getDayPosition treats them relative
      // to the grid reference date (date - 1 when wrapping, or date).
      let normalisedEvent = event;

      if (isPrevDayWrap(isOnPrevDay, wraps)) {
        // Previous-day event → shift forward 24 h into the grid coordinate
        const normalisedStart = eventStart.add(1, "day");
        const normalisedEnd = eventEnd.add(1, "day");
        normalisedEvent = {
          ...event,
          start: normalisedStart.format("YYYY-MM-DD HH:mm:ss"),
          end: normalisedEnd.format("YYYY-MM-DD HH:mm:ss"),
        };
      } else if (isOnNextDay && gridRefDate) {
        // Next-day event → shift backward 24 h
        const normalisedStart = eventStart.subtract(1, "day");
        const normalisedEnd = eventEnd.subtract(1, "day");
        const refDay = dayjs(gridRefDate).startOf("day");
        if (normalisedEnd.isBefore(refDay) || normalisedStart.isAfter(refDay.add(1, "day"))) {
          continue;
        }
        normalisedEvent = {
          ...event,
          start: normalisedStart.format("YYYY-MM-DD HH:mm:ss"),
          end: normalisedEnd.format("YYYY-MM-DD HH:mm:ss"),
        };
      }

      const validated = validateEvent(normalisedEvent);

      if (!ids.has(event.id)) {
        ids.add(event.id);
      } else {
        throw new Error(
          `[@/lib/vendored/mantine-schedule] DayView: Duplicated event ids found: ${event.id}`,
        );
      }

      if (event.display === "background") {
        backgroundFiltered.push(validated);
      } else {
        filteredEvents.push(validated);
      }
    }
  }

  // When wrapping, the grid reference is (date - 1) so that previous-day
  // events (shifted +24 h) land at the top of the grid.
  const positionRefDate = wraps ? dayStart.subtract(1, "day") : (gridRefDate ?? date);

  const positionedEvents = getDayPositionedEvents({
    events: filteredEvents,
    startTime,
    endTime,
    intervalMinutes,
    date: positionRefDate,
  });

  const allDayEvents: DayPositionedEventData[] = [];
  const regularEvents: DayPositionedEventData[] = [];

  for (const event of positionedEvents) {
    if (event.position.allDay) {
      allDayEvents.push(event);
    } else {
      regularEvents.push(event);
    }
  }

  const backgroundTimedEvents: DayPositionedEventData[] = [];
  const backgroundAllDayEvents: DayPositionedEventData[] = [];
  for (const event of backgroundFiltered) {
    const eventStart = dayjs(event.start);
    const eventEnd = dayjs(event.end);
    const clippedStart = eventStart.isBefore(dayStart) ? dayStart : eventStart;
    const clippedEnd = eventEnd.isAfter(dayEnd) ? dayEnd : eventEnd;

    const clippedEvent = {
      ...event,
      start: clippedStart.format("YYYY-MM-DD HH:mm:ss"),
      end: clippedEnd.format("YYYY-MM-DD HH:mm:ss"),
    };

    const allDay = isAllDayEvent({ event: clippedEvent, date });

    if (allDay) {
      backgroundAllDayEvents.push({
        ...event,
        position: {
          top: 0,
          height: 100,
          allDay: true,
          width: 100,
          offset: 0,
          column: 0,
          overlaps: 1,
        },
      });
    } else {
      const { top, height } = getDayPosition({
        event: clippedEvent,
        startTime,
        endTime,
        intervalMinutes,
      });
      if (height <= 0) {
        continue;
      }
      backgroundTimedEvents.push({
        ...event,
        position: { top, height, allDay: false, width: 100, offset: 0, column: 0, overlaps: 1 },
      });
    }
  }

  return { allDayEvents, regularEvents, backgroundTimedEvents, backgroundAllDayEvents };
}

function isPrevDayWrap(isOnPrevDay: boolean, wraps: boolean): boolean {
  return isOnPrevDay && wraps;
}

import dayjs from "dayjs";
import type { AnyDateValue, DateStringValue, DayOfWeek, ScheduleEventData } from "../../../types";
import { getWeekDays, isEventInTimeRange, validateEvent } from "../../../utils";
import { getEventEndDate } from "./get-event-end-date";

export interface FilterWeekViewEventsInput {
  /** Date (week start) at which events are positioned, used to check if events are all-day */
  date: AnyDateValue;

  /** List of all events that belong to the given week, extra events must be filtered out before passing to the function */
  events: ScheduleEventData[] | undefined;

  /** Start time of the week view, used to calculate event positions */
  startTime?: string;

  /** End time of the week view, used to calculate event positions */
  endTime?: string;

  /** First day of the week, 0 - Sunday, 1 - Monday, etc., used to calculate events positions */
  firstDayOfWeek?: DayOfWeek;

  /**
   * Explicit list of 7 visible dates (each formatted `YYYY-MM-DD HH:mm:ss`).
   * When provided, takes precedence over `date` so the filter does not
   * re-derive a scope week that might not match the rendered grid (e.g.
   * around/future windows).
   */
  weekDays?: DateStringValue[];
}

function isEventInWeekDays(event: ScheduleEventData, weekDays: DateStringValue[]): boolean {
  const eventStartDate = dayjs(event.start).startOf("day");
  const actualEndDate = getEventEndDate(event);
  return weekDays.some((day) => {
    const dayDate = dayjs(day).startOf("day");
    return (
      (dayDate.isAfter(eventStartDate) || dayDate.isSame(eventStartDate)) &&
      (dayDate.isBefore(actualEndDate) || dayDate.isSame(actualEndDate))
    );
  });
}

export function filterWeekViewEvents({
  weekDays: explicitWeekDays,
  date,
  events,
  startTime,
  endTime,
  firstDayOfWeek = 1,
}: FilterWeekViewEventsInput): ScheduleEventData[] {
  if (events === undefined) {
    return [];
  }

  const weekDays =
    explicitWeekDays ?? getWeekDays({ week: date, firstDayOfWeek });

  const ids = new Set<string | number>();
  const filteredEvents: ScheduleEventData[] = [];

  for (const event of events) {
    if (
      isEventInWeekDays(event, weekDays) &&
      isEventInTimeRange({ event, startTime, endTime })
    ) {
      filteredEvents.push(validateEvent(event));

      if (!ids.has(event.id)) {
        ids.add(event.id);
      } else {
        throw new Error(
          `[@/lib/vendored/mantine-schedule] WeekView: Duplicated event ids found: ${event.id}`,
        );
      }
    }
  }

  return filteredEvents;
}

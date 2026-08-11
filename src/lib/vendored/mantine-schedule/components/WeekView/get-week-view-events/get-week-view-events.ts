import type { DateStringValue, ScheduleEventData } from "../../../types";
import { filterWeekViewEvents } from "./filter-week-view-events";
import {
  type GetWeekPositionedEventsInput,
  type GroupedWeekEvents,
  getWeekPositionedEvents,
} from "./get-week-positioned-events";

interface GetWeekViewEventsInput extends Omit<GetWeekPositionedEventsInput, "events"> {
  events: ScheduleEventData[] | undefined;

  /**
   * Explicit list of 7 visible dates. Forwarded to `filterWeekViewEvents`
   * and `getWeekPositionedEvents` so the filter and the rendered grid
   * agree on which dates are visible (matters for around/future modes
   * where the rendered grid does not coincide with the scope week of
   * `date`).
   */
  weekDays?: DateStringValue[];
}

export function getWeekViewEvents(input: GetWeekViewEventsInput): GroupedWeekEvents {
  const { weekDays, ...rest } = input;
  return getWeekPositionedEvents({
    ...rest,
    weekDays,
    events: filterWeekViewEvents(input),
  });
}

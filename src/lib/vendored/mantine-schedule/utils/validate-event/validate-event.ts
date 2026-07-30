import dayjs from "dayjs";
import type { ScheduleEventData } from "../../types";

export function validateEvent(eventData: ScheduleEventData) {
  if (!dayjs(eventData.start).isValid()) {
    throw new Error(
      `[@/lib/vendored/mantine-schedule] Invalid start date for event id: ${eventData.id}`,
    );
  }

  if (!dayjs(eventData.end).isValid()) {
    throw new Error(
      `[@/lib/vendored/mantine-schedule] Invalid end date for event id: ${eventData.id}`,
    );
  }

  if (dayjs(eventData.end).isBefore(dayjs(eventData.start))) {
    throw new Error(
      `[@/lib/vendored/mantine-schedule] Event end date is before start date for event id: ${eventData.id}`,
    );
  }

  return eventData;
}

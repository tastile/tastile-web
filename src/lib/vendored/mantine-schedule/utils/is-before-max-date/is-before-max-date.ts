import dayjs from "dayjs";
import type { AnyDateValue } from "../../types";

export function isBeforeMaxDate(date: AnyDateValue, maxDate: AnyDateValue | undefined) {
  return maxDate ? dayjs(date).isBefore(dayjs(maxDate).add(1, "day"), "day") : true;
}

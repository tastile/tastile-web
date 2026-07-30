import dayjs from "dayjs";
import type { AnyDateValue } from "../../types";

export function isAfterMinDate(date: AnyDateValue, minDate: AnyDateValue | undefined) {
  return minDate ? dayjs(date).isAfter(dayjs(minDate).subtract(1, "day"), "day") : true;
}

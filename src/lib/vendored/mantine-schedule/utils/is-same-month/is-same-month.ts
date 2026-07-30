import dayjs from "dayjs";
import type { AnyDateValue } from "../../types";

export function isSameMonth(date: AnyDateValue, comparison: AnyDateValue) {
  return dayjs(date).format("YYYY-MM") === dayjs(comparison).format("YYYY-MM");
}

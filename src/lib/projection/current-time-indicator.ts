export interface CurrentTimeIndicatorPosition {
  todayIso: string;
  minutesFromMidnight: number;
  topPx: number;
}

const PX_PER_MINUTE = 1.5;

export function getCurrentTimeIndicatorPosition(
  nowMs: number,
  tzOffsetMinutes: number,
): CurrentTimeIndicatorPosition {
  const localDate = new Date(nowMs + tzOffsetMinutes * 60_000);
  const minutesFromMidnight = localDate.getUTCHours() * 60 + localDate.getUTCMinutes();

  return {
    todayIso: localDate.toISOString().slice(0, 10),
    minutesFromMidnight,
    topPx: minutesFromMidnight * PX_PER_MINUTE,
  };
}

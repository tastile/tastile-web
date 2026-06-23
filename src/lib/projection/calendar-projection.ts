import type {
  CalendarBlockView,
  CalendarProjectionView,
} from "@/lib/hooks/use-calendar-projection";

export function blocksForDate(
  projection: CalendarProjectionView,
  dateStr: string,
): CalendarBlockView[] {
  return projection.blocks.filter((b) => {
    const start = b.start_at.slice(0, 10);
    const end = b.end_at.slice(0, 10);
    return start <= dateStr && end >= dateStr;
  });
}

export function allDayBlocksFor(
  projection: CalendarProjectionView,
  dateStr: string,
): CalendarBlockView[] {
  return projection.all_day_spans.filter((b) => {
    const start = b.start_at.slice(0, 10);
    const end = b.end_at.slice(0, 10);
    return start <= dateStr && end >= dateStr;
  });
}

export function hourSlotsForDay(dateStr: string, tzOffsetMinutes: number): Date[] {
  const [year, month, day] = dateStr.split("-").map(Number);
  const slots: Date[] = [];
  for (let h = 0; h < 24; h++) {
    const utcMs = Date.UTC(year, month - 1, day, h, 0, 0) - tzOffsetMinutes * 60_000;
    slots.push(new Date(utcMs));
  }
  return slots;
}

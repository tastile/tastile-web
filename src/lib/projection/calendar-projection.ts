import type { TimelineProjection } from "./timeline-to-blocks";

export function blocksForDate(p: TimelineProjection, dateStr: string) {
  return p.blocks.filter((b) => {
    const s = b.start_at.slice(0, 10);
    const e = b.end_at.slice(0, 10);
    return s <= dateStr && e >= dateStr;
  });
}

export function allDayBlocksFor(p: TimelineProjection, dateStr: string) {
  return p.allDaySpans.filter((b) => {
    const s = b.start_at.slice(0, 10);
    const e = b.end_at.slice(0, 10);
    return s <= dateStr && e >= dateStr;
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

"use client";

import type { CalendarBlockView } from "@/lib/hooks/use-calendar-projection";
import { useLabelsStore } from "@/lib/stores/labels-store";

function AllDayChip({ span }: { span: CalendarBlockView }) {
  useLabelsStore.getState().ensureLabel(span.source_label);
  const color = useLabelsStore((s) => s.labels[span.source_label]?.color ?? "#6b7280");
  return (
    <span
      className="inline-flex items-center rounded px-2 py-0.5 text-[10px] font-medium text-foreground"
      style={{
        backgroundColor: `color-mix(in oklab, ${color} 12%, transparent)`,
      }}
    >
      <span
        aria-hidden
        className="mr-1 inline-block h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: color }}
      />
      {span.title}
    </span>
  );
}

export function AllDayLane({ spans }: { spans: CalendarBlockView[] }) {
  if (spans.length === 0) return null;

  return (
    <div className="flex gap-1 px-10 pb-2">
      {spans.map((span, i) => (
        <AllDayChip key={`${span.tile_id}-${i}`} span={span} />
      ))}
    </div>
  );
}

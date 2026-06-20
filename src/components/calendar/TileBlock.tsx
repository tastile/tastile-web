"use client";

import type { CalendarBlockView } from "@/lib/hooks/use-calendar-projection";
import { useLabelsStore } from "@/lib/stores/labels-store";
import { cn } from "@/lib/utils/cn";

export function TileBlock({
  block,
  onClick,
  dimmed,
}: {
  block: CalendarBlockView;
  onClick: () => void;
  dimmed?: boolean;
}) {
  useLabelsStore.getState().ensureLabel(block.source_label);
  const color = useLabelsStore((s) => s.labels[block.source_label]?.color ?? "#6b7280");
  const notEditable = !block.editable;
  const start = new Date(block.start_at);
  const end = new Date(block.end_at);
  const minutes = Math.max(5, Math.round((end.getTime() - start.getTime()) / 60_000));

  return (
    <button
      type="button"
      data-tile-block="true"
      onClick={onClick}
      disabled={notEditable}
      style={{
        // @ts-expect-error CSS custom property
        "--accent": color,
        height: `${Math.max(20, minutes * 1.5)}px`,
        opacity: dimmed ? 0.3 : 1,
      }}
      className={cn(
        "relative w-full overflow-hidden rounded-md px-2 py-1 text-left",
        "bg-[color-mix(in_oklab,var(--accent)_8%,transparent)]",
        notEditable ? "cursor-default" : "hover:bg-[color-mix(in_oklab,var(--accent)_14%,transparent)]",
      )}
    >
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 w-1 bg-[var(--accent)]"
      />
      <div className="text-xs font-medium text-foreground">{block.title}</div>
      <div className="font-mono text-[10px] text-foreground-subtle">
        {Math.round(minutes)}m
        {notEditable ? " · read-only" : ""}
      </div>
    </button>
  );
}

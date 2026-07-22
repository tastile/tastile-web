"use client";

import { cn } from "@/lib/utils/cn";

export interface TileBlockProps {
  block: {
    tile_id: string;
    title: string;
    start_at: string;
    end_at: string;
    source_label: string;
    editable: boolean;
    color?: string;
    minutes?: number;
  };
  onClick: () => void;
  dimmed?: boolean;
}

export function TileBlock({ block, onClick, dimmed }: TileBlockProps) {
  const start = new Date(block.start_at);
  const end = new Date(block.end_at);
  const minutes =
    block.minutes ?? Math.max(5, Math.round((end.getTime() - start.getTime()) / 60_000));
  const accent = block.color ?? "#6b7280";
  const notEditable = !block.editable;

  return (
    <button
      type="button"
      data-tile-block="true"
      data-event-id={block.tile_id}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      disabled={notEditable}
      style={
        {
          "--accent": accent,
          height: `${Math.max(20, minutes * 1.5)}px`,
          opacity: dimmed ? 0.3 : 1,
        } as React.CSSProperties
      }
      className={cn(
        "relative w-full overflow-hidden rounded-md px-2 py-1 text-left",
        "bg-[color-mix(in_oklab,var(--accent)_18%,var(--surface-1))]",
        notEditable
          ? "cursor-default"
          : "hover:bg-[color-mix(in_oklab,var(--accent)_26%,var(--surface-1))]",
      )}
    >
      <span aria-hidden className="absolute inset-y-0 left-0 w-1 bg-[var(--accent)]" />
      <div className="text-xs font-medium text-foreground">{block.title}</div>
      <div className="font-mono text-[10px] text-foreground-subtle">
        {Math.round(minutes)}m{notEditable ? " · read-only" : ""}
      </div>
    </button>
  );
}

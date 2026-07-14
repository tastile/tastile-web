"use client";

import { memo } from "react";
import { eventTileStyle, formatLocalTimeOfDay } from "@/lib/calendar/layout";
import type { CalendarEvent } from "@/lib/domain/calendar";

export interface WeekViewTileProps {
  event: CalendarEvent;
  top: number;
  height: number;
  laneIndex: number;
  laneCount: number;
  tzOffset: number;
  onEditEvent?: (event: CalendarEvent) => void;
}

/**
 * One timed event in the week time-grid. Memoized so a 60 s now-line
 * tick or any other upstream re-render doesn't repaint every event.
 *
 * `onEditEvent` must be a stable reference (useCallback) for memo to
 * take effect.
 */
function WeekViewTileImpl({
  event,
  top,
  height,
  laneIndex,
  laneCount,
  tzOffset,
  onEditEvent,
}: WeekViewTileProps) {
  const tile = eventTileStyle(event.color);
  const widthPct = 100 / laneCount;
  const leftPct = widthPct * laneIndex;

  return (
    <button
      type="button"
      data-testid={`week-event-${event.id}`}
      data-lane={laneIndex}
      data-lane-count={laneCount}
      onClick={onEditEvent ? () => onEditEvent(event) : undefined}
      className="absolute overflow-hidden rounded-sm px-1 py-0.5 text-left hover:brightness-95"
      style={{
        top: `${top}px`,
        height: `${height}px`,
        left: `calc(${leftPct}% + 1px)`,
        width: `calc(${widthPct}% - 2px)`,
        backgroundColor: tile.backgroundColor,
        color: tile.color,
      }}
    >
      <div className="truncate text-[10px] font-medium leading-tight">
        {event.title || "(untitled)"}
      </div>
      <div className="truncate font-mono text-[9px] opacity-80">
        {formatLocalTimeOfDay(event.start, tzOffset)} – {formatLocalTimeOfDay(event.end, tzOffset)}
      </div>
    </button>
  );
}

export const WeekViewTile = memo(WeekViewTileImpl);

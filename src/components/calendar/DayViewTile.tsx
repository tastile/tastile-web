"use client";

import { memo } from "react";
import { eventTileStyle, formatLocalTimeOfDay } from "@/lib/calendar/layout";
import type { CalendarEvent } from "@/lib/domain/calendar";

export interface DayViewTileProps {
  event: CalendarEvent;
  top: number;
  height: number;
  laneIndex: number;
  laneCount: number;
  tzOffset: number;
  onEditEvent?: (event: CalendarEvent) => void;
}

/**
 * One timed event in the day time-grid. Memoized so that ticks from
 * the NowIndicator, anchor/mode changes that don't touch this event,
 * and unrelated re-renders do not repaint every tile.
 *
 * `onEditEvent` must be a stable reference (useCallback at the
 * CalendarMain level) for memo to be effective.
 */
function DayViewTileImpl({
  event,
  top,
  height,
  laneIndex,
  laneCount,
  tzOffset,
  onEditEvent,
}: DayViewTileProps) {
  const tile = eventTileStyle(event.color);
  const widthPct = 100 / laneCount;
  const leftPct = widthPct * laneIndex;

  return (
    <div
      role={onEditEvent ? "button" : undefined}
      tabIndex={onEditEvent ? 0 : undefined}
      data-testid={`day-event-${event.id}`}
      data-lane={laneIndex}
      data-lane-count={laneCount}
      data-tile-id={event.id}
      onClick={onEditEvent ? () => onEditEvent(event) : undefined}
      onKeyDown={
        onEditEvent
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onEditEvent(event);
              }
            }
          : undefined
      }
      className="absolute overflow-hidden rounded-md px-2 py-1 text-left hover:brightness-95"
      style={{
        top: `${top}px`,
        height: `${height}px`,
        left: `calc(${leftPct}% + 2px)`,
        width: `calc(${widthPct}% - 4px)`,
        backgroundColor: tile.backgroundColor,
        color: tile.color,
      }}
    >
      <div className="flex items-center gap-1.5">
        <span
          aria-hidden
          className="inline-block h-2 w-2 shrink-0 rounded-full"
          style={{ backgroundColor: tile.color }}
        />
        <span className="truncate text-xs font-medium">{event.title || "(untitled)"}</span>
      </div>
      <div className="mt-0.5 truncate font-mono text-[10px] opacity-80">
        {formatLocalTimeOfDay(event.start, tzOffset)} – {formatLocalTimeOfDay(event.end, tzOffset)}
      </div>
      {event.location ? (
        <div className="mt-0.5 truncate text-[10px] opacity-70">{event.location}</div>
      ) : null}
    </div>
  );
}

export const DayViewTile = memo(DayViewTileImpl);

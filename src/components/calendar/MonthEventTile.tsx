"use client";

import { memo } from "react";
import { monthEventStyle } from "@/lib/calendar/layout";
import type { CalendarEvent } from "@/lib/domain/calendar";

export interface MonthEventTileProps {
  event: CalendarEvent;
}

function _pad(n: number): string {
  return n.toString().padStart(2, "0");
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
}

/**
 * One event chip inside a month cell. Memoized — when the parent
 * re-renders (e.g. 60 s now-line tick in the day column, scroll
 * through month cells), only the chips whose `event` reference
 * actually changed repaint.
 */
function MonthEventTileImpl({ event }: MonthEventTileProps) {
  const tile = monthEventStyle(event.color);
  return (
    <button
      type="button"
      data-testid={`month-event-${event.id}`}
      className="block w-full truncate rounded-sm px-1.5 py-0.5 text-left text-[10px] hover:brightness-95"
      style={{
        backgroundColor: tile.backgroundColor,
        color: tile.color,
      }}
    >
      {event.allDay ? "" : `${formatTime(event.start)} `}
      {event.title}
    </button>
  );
}

export const MonthEventTile = memo(MonthEventTileImpl);

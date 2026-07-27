"use client";

import { type KeyboardEvent, memo } from "react";
import { monthEventStyle } from "@/lib/calendar/layout";
import type { CalendarEvent } from "@/lib/domain/calendar";

export interface MonthEventTileProps {
  event: CalendarEvent;
  date: string;
  onEditEvent?: (event: CalendarEvent) => void;
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
function MonthEventTileImpl({ event, date, onEditEvent }: MonthEventTileProps) {
  const tile = monthEventStyle(event.color);
  const start = event.start.slice(0, 10);
  const last = new Date(new Date(event.end).getTime() - 1).toISOString().slice(0, 10);
  const isStart = !event.allDay || date === start;
  const isEnd = !event.allDay || date === last;
  const interactiveProps = onEditEvent
    ? {
        onClick: () => onEditEvent(event),
        onKeyDown: (e: KeyboardEvent<HTMLDivElement>) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onEditEvent(event);
          }
        },
      }
    : {};
  return (
    <div
      role={onEditEvent ? "button" : undefined}
      tabIndex={onEditEvent ? 0 : undefined}
      data-testid={`month-event-${event.id}`}
      {...interactiveProps}
      className={`block w-full truncate px-1.5 py-0.5 text-left text-[10px] hover:brightness-95 ${isStart ? "rounded-l-sm" : "rounded-l-none"} ${isEnd ? "rounded-r-sm" : "rounded-r-none"}`}
      style={{
        backgroundColor: tile.backgroundColor,
        color: tile.color,
      }}
    >
      {event.allDay ? "" : `${formatTime(event.start)} `}
      {event.allDay && !isStart ? "" : event.title}
    </div>
  );
}

export const MonthEventTile = memo(MonthEventTileImpl);

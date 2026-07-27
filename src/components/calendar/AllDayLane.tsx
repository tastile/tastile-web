"use client";

import { memo } from "react";
import { eventTileStyle } from "@/lib/calendar/layout";
import type { CalendarEvent } from "@/lib/domain/calendar";

interface AllDayChipProps {
  event: CalendarEvent;
  onClick?: (event: CalendarEvent) => void;
}

function AllDayChipImpl({ event, onClick }: AllDayChipProps) {
  const tile = eventTileStyle(event.color);
  return (
    <div
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      data-event-id={event.id}
      onClick={onClick ? () => onClick(event) : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick(event);
              }
            }
          : undefined
      }
      className="inline-flex items-center rounded px-2 py-0.5 text-[10px] font-medium hover:brightness-95 cursor-pointer"
      style={{
        backgroundColor: tile.backgroundColor,
        color: tile.color,
      }}
    >
      {event.title}
    </div>
  );
}

const AllDayChip = memo(AllDayChipImpl);

export function AllDayLane({
  events,
  onEditEvent,
}: {
  events: CalendarEvent[];
  onEditEvent?: (event: CalendarEvent) => void;
}) {
  if (events.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1 pb-2">
      {events.map((event) => (
        <AllDayChip key={event.id} event={event} onClick={onEditEvent} />
      ))}
    </div>
  );
}

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
    <button
      type="button"
      data-event-id={event.id}
      onClick={onClick ? () => onClick(event) : undefined}
      className="inline-flex items-center rounded px-2 py-0.5 text-[10px] font-medium hover:brightness-95"
      style={{
        backgroundColor: tile.backgroundColor,
        color: tile.color,
      }}
    >
      {event.title}
    </button>
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

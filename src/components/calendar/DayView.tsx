"use client";

import { useEffect, useState } from "react";
import {
  EVENT_COLOR_HEX,
  type CalendarEvent,
} from "@/lib/domain/calendar";
import { getCurrentTimeIndicatorPosition } from "@/lib/projection/current-time-indicator";
import { cn } from "@/lib/utils/cn";
import { AllDayLane } from "./AllDayLane";
import { TileBlock } from "./TileBlock";

function formatHour(slot: Date): string {
  const h = slot.getUTCHours();
  return `${h.toString().padStart(2, "0")}:00`;
}

function hourSlotsForDay(dateStr: string, tzOffsetMinutes: number): Date[] {
  const parts = dateStr.split("-").map(Number);
  const [y, m, d] = parts;
  const slots: Date[] = [];
  for (let h = 0; h < 24; h += 1) {
    const utcMs = Date.UTC(y, m - 1, d, h, 0, 0) - tzOffsetMinutes * 60_000;
    slots.push(new Date(utcMs));
  }
  return slots;
}

export interface DayViewProps {
  anchor: string;
  tzOffset: number;
  events: CalendarEvent[];
  loading: boolean;
  onCreateAtTime: (startIso: string, endIso: string) => void;
  onEventClick: (event: CalendarEvent) => void;
}

export function DayView({
  anchor,
  tzOffset,
  events,
  loading,
  onCreateAtTime,
  onEventClick,
}: DayViewProps) {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-xs text-foreground-subtle">
        Loading…
      </div>
    );
  }

  const slots = hourSlotsForDay(anchor, tzOffset);
  const dayBlocks = events.filter((e) => {
    const s = e.start.slice(0, 10);
    const ed = e.end.slice(0, 10);
    return s <= anchor && ed >= anchor && !e.allDay;
  });
  const allDay = events.filter((e) => e.allDay);
  const currentTime = getCurrentTimeIndicatorPosition(nowMs, tzOffset);
  const nowSlotIndex = Math.floor(currentTime.minutesFromMidnight / 60);
  const nowTopOffset = currentTime.minutesFromMidnight % 60;

  function handleHourClick(hour: number) {
    const y = Number(anchor.slice(0, 4));
    const m = Number(anchor.slice(5, 7));
    const d = Number(anchor.slice(8, 10));
    const start = new Date(Date.UTC(y, m - 1, d, hour, 0, 0)).toISOString();
    const end = new Date(Date.UTC(y, m - 1, d, hour + 1, 0, 0)).toISOString();
    onCreateAtTime(start, end);
  }

  return (
    <div className="relative">
      <AllDayLane events={allDay} onClick={onEventClick} />
      <div className="flex pb-16">
        <div className="flex w-16 shrink-0 flex-col border-r border-border bg-surface-0">
          {slots.map((slot) => (
            <button
              key={slot.getUTCHours()}
              type="button"
              data-testid={`day-hour-${slot.getUTCHours().toString().padStart(2, "0")}`}
              onClick={() => handleHourClick(slot.getUTCHours())}
              className="flex h-[90px] items-start justify-end pr-2 pt-1 text-[10px] text-foreground-subtle hover:bg-surface-1"
            >
              {formatHour(slot)}
            </button>
          ))}
        </div>
        <div className="relative flex-1 bg-[length:100%_90px]">
          {slots.map((slot) => {
            const h = slot.getUTCHours();
            const blocks = dayBlocks.filter(
              (b) => new Date(b.start).getUTCHours() === h,
            );
            return (
              <div
                key={h}
                className="relative h-[90px] border-b border-border/50 bg-surface-0"
              >
                {blocks.map((block) => {
                  const start = new Date(block.start);
                  const end = new Date(block.end);
                  const minutes = Math.max(
                    5,
                    Math.round((end.getTime() - start.getTime()) / 60_000),
                  );
                  return (
                    <div
                      key={block.id}
                      className="absolute left-1 right-1"
                      style={{ top: `${start.getUTCMinutes() * 1.5}px` }}
                    >
                      <TileBlock
                        block={{
                          tile_id: block.id,
                          title: block.title,
                          start_at: block.start,
                          end_at: block.end,
                          source_label: block.title,
                          editable: true,
                          color: EVENT_COLOR_HEX[block.color] ?? EVENT_COLOR_HEX.blue,
                          minutes,
                        }}
                        onClick={() => onEventClick(block)}
                      />
                    </div>
                  );
                })}
              </div>
            );
          })}
          <div
            className="pointer-events-none absolute left-0 right-0 h-px bg-primary z-20"
            style={{ top: `${nowSlotIndex * 90 + nowTopOffset * 1.5}px` }}
          >
            <span className="absolute -top-1.5 -left-1.5 h-2.5 w-2.5 rounded-full bg-primary" />
          </div>
        </div>
      </div>
    </div>
  );
}

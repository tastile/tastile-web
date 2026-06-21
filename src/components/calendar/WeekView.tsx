"use client";

import { useEffect, useState } from "react";
import { useCalendarProjection } from "@/lib/hooks/use-calendar-projection";
import { useReferenceOverlayStore } from "@/lib/stores/reference-overlay-store";
import { blocksForDate, allDayBlocksFor, hourSlotsForDay } from "@/lib/projection/calendar-projection";
import { TileBlock } from "./TileBlock";
import { AllDayLane } from "./AllDayLane";
import { cn } from "@/lib/utils/cn";

function formatHour(slot: Date): string {
  const h = slot.getUTCHours();
  return `${h.toString().padStart(2, "0")}:00`;
}

function getWeekDates(anchor: string): string[] {
  const d = new Date(anchor + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - d.getUTCDay());
  const dates = [];
  for (let i = 0; i < 7; i++) {
    dates.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return dates;
}

export function WeekView({ anchor, tzOffset, refreshKey }: { anchor: string; tzOffset: number; refreshKey?: number }) {
  const { projection, loading, error } = useCalendarProjection({ view: "week", anchor, tzOffset, refreshKey });
  const enabled = useReferenceOverlayStore((s) => s.enabled);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  if (error) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2 text-xs">
        <span className="text-danger">Failed to load calendar</span>
        <span className="text-foreground-subtle">{error.message}</span>
      </div>
    );
  }

  if (loading || !projection) {
    return <div className="flex h-64 items-center justify-center text-xs text-foreground-subtle">Loading…</div>;
  }

  const weekDates = getWeekDates(anchor);
  const slots = hourSlotsForDay(anchor, tzOffset); // Using anchor just to get the 24 hours
  const localMs = nowMs + tzOffset * 60_000;
  const localDate = new Date(localMs);
  const localMinutes = (localDate.getUTCHours() * 60 + localDate.getUTCMinutes());
  const nowSlotIndex = Math.floor(localMinutes / 60);
  const nowTopOffset = (localMinutes % 60) * 1.5;
  const todayStr = new Date(localMs).toISOString().slice(0, 10);

  return (
    <div className="relative flex flex-col h-full min-h-[600px]">
      {/* Header with day names */}
      <div className="flex border-b border-surface-2 sticky top-0 bg-surface-0 z-10">
        <div className="w-10 shrink-0" />
        {weekDates.map((dateStr) => {
          const isToday = dateStr === todayStr;
          const d = new Date(dateStr + "T00:00:00Z");
          const dayName = d.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
          const dayNum = d.getUTCDate();
          return (
            <div key={dateStr} className="flex-1 flex flex-col items-center justify-center py-2 border-l border-surface-2">
              <span className={cn("text-xs font-medium", isToday ? "text-primary" : "text-foreground-subtle")}>{dayName}</span>
              <span className={cn("text-lg", isToday ? "text-primary font-bold" : "text-foreground")}>{dayNum}</span>
            </div>
          );
        })}
      </div>

      <div className="relative flex flex-1">
        {/* Time axis */}
        <div className="w-10 shrink-0 border-r border-surface-2">
          {slots.map((slot, i) => (
            <div key={i} className="relative pr-2 text-right font-mono text-[10px] text-foreground-subtle" style={{ height: "90px" }}>
              <span className="absolute -top-2 right-2">{formatHour(slot)}</span>
            </div>
          ))}
        </div>

        {/* 7 Columns */}
        <div className="flex flex-1">
          {weekDates.map((dateStr) => {
            const dayBlocks = blocksForDate(projection, dateStr);
            const isToday = dateStr === todayStr;

            return (
              <div key={dateStr} className="relative flex-1 border-r border-surface-2 border-opacity-50">
                {/* Horizontal grid lines */}
                <div className="absolute inset-0 pointer-events-none">
                  {slots.map((_, i) => (
                    <div key={i} className="border-b border-surface-2" style={{ height: "90px" }} />
                  ))}
                </div>

                {/* Blocks */}
                {dayBlocks.map((block, bi) => {
                  const bStart = new Date(block.start_at);
                  const minutesFromMidnight = bStart.getUTCHours() * 60 + bStart.getUTCMinutes();
                  const isDimmed = enabled.length > 0 && !enabled.includes(block.source_label);
                  return (
                    <div
                      key={`${block.tile_id}-${bi}`}
                      className="absolute left-1 right-1"
                      style={{
                        top: `${minutesFromMidnight * 1.5}px`,
                      }}
                    >
                      <TileBlock
                        block={block}
                        onClick={() => {/* TODO: open edit panel */}}
                        dimmed={isDimmed}
                      />
                    </div>
                  );
                })}

                {/* Current time indicator */}
                {isToday && (
                  <div
                    className="pointer-events-none absolute left-0 right-0 h-px bg-primary z-20"
                    style={{ top: `${(nowSlotIndex * 60 + nowTopOffset) * 1.5}px` }}
                  >
                    <span className="absolute -top-1.5 -left-1.5 h-2.5 w-2.5 rounded-full bg-primary" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useCalendarProjection } from "@/lib/hooks/use-calendar-projection";
import { getCurrentTimeIndicatorPosition } from "@/lib/projection/current-time-indicator";
import { useReferenceOverlayStore } from "@/lib/stores/reference-overlay-store";
import { useTileEditStore } from "@/lib/stores/tile-edit-store";
import { blocksForDate, allDayBlocksFor } from "@/lib/projection/calendar-projection";
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

export function WeekView({ anchor, tzOffset }: { anchor: string; tzOffset: number }) {
  const { projection, loading, error } = useCalendarProjection({ view: "week", anchor, tzOffset });
  const enabled = useReferenceOverlayStore((s) => s.enabled);
  const openEdit = useTileEditStore((s) => s.openEdit);
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
  const currentTime = getCurrentTimeIndicatorPosition(nowMs, tzOffset);
  const todayIso = currentTime.todayIso;

  return (
    <div className="flex flex-col relative bg-surface-0 pb-16">
      {/* Header row */}
      <div className="flex border-b border-border bg-surface-1">
        <div className="w-16 shrink-0 border-r border-border" />
        {weekDates.map((date) => {
          const d = new Date(date + "T00:00:00Z");
          const dayName = d.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
          const dayNum = d.getUTCDate();
          const isToday = date === todayIso;
          return (
            <div
              key={date}
              className={cn(
                "flex-1 border-r border-border py-2 text-center text-xs",
                isToday ? "bg-surface-elevated font-semibold text-primary" : "text-foreground-subtle",
              )}
            >
              <div className="uppercase tracking-widest">{dayName}</div>
              <div className={cn("mt-1 text-sm", isToday && "text-primary")}>{dayNum}</div>
            </div>
          );
        })}
      </div>

      {/* All-Day Lane */}
      <div className="flex border-b border-border">
        <div className="flex w-16 shrink-0 items-center justify-center border-r border-border bg-surface-1 text-[10px] text-foreground-subtle uppercase">
          All Day
        </div>
        <div className="flex-1 relative min-h-[40px] bg-surface-0">
          {weekDates.map((date, i) => {
            const allDay = allDayBlocksFor(projection, date);
            return (
              <div
                key={date}
                className="absolute top-0 bottom-0 border-r border-border"
                style={{ left: `${(i / 7) * 100}%`, width: `${100 / 7}%` }}
              >
                <div className="relative h-full w-full">
                  <AllDayLane spans={allDay} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Time Grid */}
      <div className="flex relative">
        <div className="w-16 shrink-0 border-r border-border bg-surface-1" />
        <div className="flex-1 bg-[url('/grid.svg')] bg-[length:100%_90px]" />
      </div>

      <div className="absolute top-[80px] bottom-0 left-0 right-0 flex pointer-events-none">
        {/* Hours column */}
        <div className="flex w-16 shrink-0 flex-col border-r border-border bg-surface-0 pointer-events-auto">
          {Array.from({ length: 24 }).map((_, i) => (
            <div key={i} className="flex h-[90px] items-start justify-end pr-2 pt-1">
              <span className="text-[10px] text-foreground-subtle">
                {formatHour(new Date(`1970-01-01T${i.toString().padStart(2, "0")}:00:00Z`))}
              </span>
            </div>
          ))}
        </div>

        {/* 7 Days Columns */}
        <div className="flex flex-1 pointer-events-auto">
          {weekDates.map((date) => {
            const dayBlocks = blocksForDate(projection, date);
            const isToday = date === todayIso;

            return (
              <div key={date} className="relative flex-1 border-r border-border last:border-r-0">
                {/* Horizontal grid lines per hour for this day */}
                <div className="absolute inset-0 pointer-events-none opacity-20">
                  {Array.from({ length: 24 }).map((_, i) => (
                    <div key={i} className="h-[90px] border-b border-border" />
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
                        onClick={() => {
                          if (block.tile_id) {
                            openEdit(block.tile_id, block.title, block.start_at, block.end_at || "", []);
                          }
                        }}
                        dimmed={isDimmed}
                      />
                    </div>
                  );
                })}

                {/* Current time indicator */}
                {isToday && (
                  <div
                    className="pointer-events-none absolute left-0 right-0 h-px bg-primary z-20"
                    style={{ top: `${currentTime.topPx}px` }}
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

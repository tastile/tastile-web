"use client";

import { useEffect, useState } from "react";
import {
  EVENT_COLOR_HEX,
  type CalendarEvent,
} from "@/lib/domain/calendar";
import { getCurrentTimeIndicatorPosition } from "@/lib/projection/current-time-indicator";
import { useQuickCreateStore } from "@/lib/stores/quick-create-store";
import { cn } from "@/lib/utils/cn";
import { AllDayLane } from "./AllDayLane";
import { TileBlock } from "./TileBlock";

function formatHour(slot: Date): string {
  const h = slot.getUTCHours();
  return `${h.toString().padStart(2, "0")}:00`;
}

function getWeekDates(anchor: string): string[] {
  const d = new Date(`${anchor}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - d.getUTCDay());
  const dates = [];
  for (let i = 0; i < 7; i += 1) {
    dates.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return dates;
}

export interface WeekViewProps {
  anchor: string;
  tzOffset: number;
  events: CalendarEvent[];
  loading: boolean;
  onEventClick: (event: CalendarEvent) => void;
}

export function WeekView({
  anchor,
  tzOffset,
  events,
  loading,
  onEventClick,
}: WeekViewProps) {
  const [nowMs, setNowMs] = useState(() => Date.now());
  const openTileCreate = useQuickCreateStore((s) => s.openAt);

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

  const weekDates = getWeekDates(anchor);
  const currentTime = getCurrentTimeIndicatorPosition(nowMs, tzOffset);
  const todayIso = currentTime.todayIso;

  return (
    <div className="flex flex-col relative bg-surface-0 pb-16">
      <div className="flex border-b border-border bg-surface-1">
        <div className="w-16 shrink-0 border-r border-border" />
        {weekDates.map((date) => {
          const d = new Date(`${date}T00:00:00Z`);
          const dayName = d.toLocaleDateString("en-US", {
            weekday: "short",
            timeZone: "UTC",
          });
          const dayNum = d.getUTCDate();
          const isToday = date === todayIso;
          return (
            <div
              key={date}
              className={cn(
                "flex-1 border-r border-border py-2 text-center text-xs",
                isToday
                  ? "bg-surface-elevated font-semibold text-primary"
                  : "text-foreground-subtle",
              )}
            >
              <div className="uppercase tracking-widest">{dayName}</div>
              <div className={cn("mt-1 text-sm", isToday && "text-primary")}>
                {dayNum}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex border-b border-border">
        <div className="flex w-16 shrink-0 items-center justify-center border-r border-border bg-surface-1 text-[10px] text-foreground-subtle uppercase">
          All Day
        </div>
        <div className="flex-1 relative min-h-[40px] bg-surface-0">
          {weekDates.map((date) => {
            const allDay = events.filter(
              (e) => e.allDay && e.start.slice(0, 10) <= date && e.end.slice(0, 10) >= date,
            );
            return (
              <div
                key={date}
                className="absolute top-0 bottom-0 border-r border-border"
                style={{ left: `${(weekDates.indexOf(date) / 7) * 100}%`, width: `${100 / 7}%` }}
              >
                <AllDayLane events={allDay} onClick={onEventClick} />
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex relative pb-16">
        <div className="flex w-16 shrink-0 flex-col border-r border-border bg-surface-0">
          {Array.from({ length: 24 }).map((_, i) => (
            <div
              key={i}
              className="flex h-[90px] items-start justify-end pr-2 pt-1"
            >
              <span className="text-[10px] text-foreground-subtle">
                {formatHour(
                  new Date(`1970-01-01T${i.toString().padStart(2, "0")}:00:00Z`),
                )}
              </span>
            </div>
          ))}
        </div>

        <div className="flex flex-1 bg-[length:100%_90px]">
          {weekDates.map((date) => {
            const dayBlocks = events.filter((e) => {
              if (e.allDay) return false;
              return (
                e.start.slice(0, 10) <= date && e.end.slice(0, 10) >= date
              );
            });
            const isToday = date === todayIso;

            return (
              <div
                key={date}
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  // Secondary entry point — toolbar [+ Create] is primary.
                  // Clicking a day column opens the tile creator with a
                  // pre-filled span based on the click Y-offset snapped
                  // to the nearest 30-minute slot.
                  const target = e.currentTarget;
                  const rect = target.getBoundingClientRect();
                  const minutesFromTop = Math.max(
                    0,
                    Math.min(
                      47 * 30,
                      Math.round(
                        ((e.clientY - rect.top) / 1.5 / 30) * 30,
                      ) * 30,
                    ),
                  );
                  const hour = Math.floor(minutesFromTop / 60);
                  const minutes = minutesFromTop % 60;
                  const d = new Date(`${date}T00:00:00Z`);
                  const startIso = new Date(
                    Date.UTC(
                      d.getUTCFullYear(),
                      d.getUTCMonth(),
                      d.getUTCDate(),
                      hour,
                      minutes,
                      0,
                    ),
                  ).toISOString();
                  const endIso = new Date(
                    Date.UTC(
                      d.getUTCFullYear(),
                      d.getUTCMonth(),
                      d.getUTCDate(),
                      hour,
                      minutes + 30,
                      0,
                    ),
                  ).toISOString();
                  openTileCreate({ defaultStart: startIso, defaultEnd: endIso });
                }}
                onKeyDown={(e) => {
                  if (e.key !== "Enter" && e.key !== " ") return;
                  e.preventDefault();
                  const d = new Date(`${date}T00:00:00Z`);
                  const startIso = new Date(
                    Date.UTC(
                      d.getUTCFullYear(),
                      d.getUTCMonth(),
                      d.getUTCDate(),
                      9,
                      0,
                      0,
                    ),
                  ).toISOString();
                  const endIso = new Date(
                    Date.UTC(
                      d.getUTCFullYear(),
                      d.getUTCMonth(),
                      d.getUTCDate(),
                      10,
                      0,
                      0,
                    ),
                  ).toISOString();
                  openTileCreate({ defaultStart: startIso, defaultEnd: endIso });
                }}
                aria-label={`Create tile on ${date}`}
                className="relative flex-1 cursor-cell border-r border-border last:border-r-0 hover:bg-surface-1/40"
              >
                <div className="absolute inset-0 pointer-events-none opacity-20">
                  {Array.from({ length: 24 }).map((_, i) => (
                    <div key={i} className="h-[90px] border-b border-border" />
                  ))}
                </div>

                {dayBlocks.map((block) => {
                  const start = new Date(block.start);
                  const minutesFromMidnight =
                    start.getUTCHours() * 60 + start.getUTCMinutes();
                  const end = new Date(block.end);
                  const minutes = Math.max(
                    5,
                    Math.round((end.getTime() - start.getTime()) / 60_000),
                  );
                  return (
                    <div
                      key={block.id}
                      className="absolute left-1 right-1"
                      style={{ top: `${minutesFromMidnight * 1.5}px` }}
                    >
                      <TileBlock
                        block={{
                          tile_id: block.id,
                          title: block.title,
                          start_at: block.start,
                          end_at: block.end,
                          source_label: block.title,
                          editable: true,
                          color:
                            EVENT_COLOR_HEX[block.color] ?? EVENT_COLOR_HEX.blue,
                          minutes,
                        }}
                        onClick={() => onEventClick(block)}
                      />
                    </div>
                  );
                })}

                {isToday ? (
                  <div
                    className="pointer-events-none absolute left-0 right-0 h-px bg-primary z-20"
                    style={{ top: `${currentTime.topPx}px` }}
                  >
                    <span className="absolute -top-1.5 -left-1.5 h-2.5 w-2.5 rounded-full bg-primary" />
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

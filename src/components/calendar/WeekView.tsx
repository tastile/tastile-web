"use client";
import { useEffect, useMemo, useState } from "react";
import {
  type DisplayMode,
  eventSpansDay,
  eventTileStyle,
  formatLocalTimeOfDay,
  getWeekViewDates,
  layoutDayLanes,
} from "@/lib/calendar/layout";
import type { CalendarEvent } from "@/lib/domain/calendar";
import { useZoom } from "@/lib/hooks/use-zoom";
import { cn } from "@/lib/utils/cn";
import { AllDayLane } from "./AllDayLane";

export interface WeekViewProps {
  anchor: string;
  mode: DisplayMode;
  tzOffset: number;
  events: CalendarEvent[];
  loading: boolean;
  onCreateAtSlot?: (anchor: string, hour: number) => void;
  onEditEvent?: (event: CalendarEvent) => void;
}

const HOUR_HEIGHT_DEFAULT = 56;
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

export function WeekView({
  anchor,
  mode,
  tzOffset,
  events,
  loading,
  onCreateAtSlot,
  onEditEvent,
}: WeekViewProps) {
  const { ref: gridRef, zoom: hourHeight } = useZoom<HTMLDivElement>({
    initial: HOUR_HEIGHT_DEFAULT,
  });
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const weekDates = useMemo(
    () => getWeekViewDates(mode, anchor, tzOffset),
    [mode, anchor, tzOffset],
  );
  const now = new Date(nowMs);
  const nowDay = `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-${pad(now.getDate())}`;
  const nowMins = now.getHours() * 60 + now.getMinutes();
  const nowTop = (nowMins / 60) * hourHeight;

  const perDay = useMemo(() => {
    const m = new Map<
      string,
      { allDay: CalendarEvent[]; timed: ReturnType<typeof layoutDayLanes> }
    >();
    for (const d of weekDates) {
      const dayEvents = events.filter((e) => eventSpansDay(e, d));
      m.set(d, {
        allDay: dayEvents.filter((e) => e.allDay),
        timed: layoutDayLanes(
          dayEvents.filter((e) => !e.allDay),
          d,
          hourHeight,
          tzOffset,
        ),
      });
    }
    return m;
  }, [events, weekDates, hourHeight]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-xs text-foreground-subtle">
        Loading…
      </div>
    );
  }

  return (
    <div className="flex flex-col rounded-md border border-surface-2 bg-surface-0 overflow-clip">
      <div className="sticky top-0 z-30 bg-surface-1">
        <div
          className="grid border-b border-surface-2"
          style={{ gridTemplateColumns: "4rem repeat(7, 1fr)" }}
        >
          <div className="border-r border-surface-2" />
          {weekDates.map((d) => {
            const dd = new Date(`${d}T00:00:00Z`);
            const isToday = d === nowDay;
            return (
              <div
                key={d}
                className={cn(
                  "flex flex-col items-center border-r border-surface-2 py-1.5 text-[11px] last:border-r-0",
                  isToday && "bg-surface-2/40",
                )}
              >
                <span className="font-semibold uppercase tracking-wider text-foreground-subtle">
                  {WEEKDAYS[dd.getUTCDay()]}
                </span>
                <span
                  className={cn(
                    "mt-0.5 text-sm font-semibold",
                    isToday ? "text-primary" : "text-foreground",
                  )}
                >
                  {dd.getDate()}
                </span>
              </div>
            );
          })}
        </div>
        <div
          className="grid border-b border-surface-2"
          style={{ gridTemplateColumns: "4rem repeat(7, 1fr)" }}
        >
          <div className="flex items-center justify-center border-r border-surface-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-foreground-subtle">
            All day
          </div>
          {weekDates.map((d) => (
            <div
              key={d}
              data-testid={`week-all-day-${d}`}
              className="min-h-[40px] border-r border-surface-2 px-1 py-1 last:border-r-0"
            >
              <AllDayLane events={perDay.get(d)?.allDay ?? []} onEditEvent={onEditEvent} />
            </div>
          ))}
        </div>
      </div>
      <div
        ref={gridRef}
        className="relative grid"
        style={{ gridTemplateColumns: "4rem repeat(7, 1fr)", height: `${24 * hourHeight}px` }}
      >
        <div className="flex flex-col border-r border-surface-2">
          {HOURS.map((h) => (
            <div
              key={h}
              className="flex items-start justify-end border-b border-surface-2/60 pr-2 pt-1"
              style={{ height: `${hourHeight}px` }}
            >
              <span className="font-mono text-[10px] text-foreground-subtle">{pad(h)}:00</span>
            </div>
          ))}
        </div>
        {weekDates.map((d) => {
          const isToday = d === nowDay;
          const day = perDay.get(d);
          return (
            <div
              key={d}
              data-testid={`week-day-${d}`}
              className="relative border-r border-surface-2 last:border-r-0"
            >
              {HOURS.map((h) => (
                <button
                  key={h}
                  type="button"
                  data-testid={`week-slot-${d}-${pad(h)}`}
                  onClick={onCreateAtSlot ? () => onCreateAtSlot(d, h) : undefined}
                  className="block w-full border-b border-surface-2/60 text-left hover:bg-surface-1/40 focus:outline-hidden focus-visible:bg-surface-1/40"
                  style={{ height: `${hourHeight}px`, padding: 0 }}
                />
              ))}
              {(day?.timed ?? []).map(({ event, top, height, laneIndex, laneCount }) => {
                const tile = eventTileStyle(event.color);
                const widthPct = 100 / laneCount;
                const leftPct = widthPct * laneIndex;
                return (
                  <button
                    key={event.id}
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
                      {formatLocalTimeOfDay(event.start, tzOffset)} –{" "}
                      {formatLocalTimeOfDay(event.end, tzOffset)}
                    </div>
                  </button>
                );
              })}
              {isToday ? (
                <div
                  className="pointer-events-none absolute left-0 right-0 z-20 h-px bg-primary"
                  style={{ top: `${nowTop}px` }}
                >
                  <span className="absolute -top-1.5 -left-1.5 h-2.5 w-2.5 rounded-full bg-primary" />
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

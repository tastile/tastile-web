"use client";
import { useEffect, useMemo, useState } from "react";
import {
  type DisplayMode,
  eventSpansDay,
  eventTileStyle,
  formatLocalTimeOfDay,
  getDayViewHourOffsets,
  layoutDayLanes,
} from "@/lib/calendar/layout";
import type { CalendarEvent } from "@/lib/domain/calendar";
import { useZoom } from "@/lib/hooks/use-zoom";
import { AllDayLane } from "./AllDayLane";

export interface DayViewProps {
  anchor: string;
  mode: DisplayMode;
  tzOffset: number;
  events: CalendarEvent[];
  loading: boolean;
  onCreateAtSlot?: (anchor: string, hour: number) => void;
  onEditEvent?: (event: CalendarEvent) => void;
}

const HOUR_HEIGHT_DEFAULT = 56;

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

export function DayView({
  anchor,
  mode,
  tzOffset,
  events,
  loading,
  onCreateAtSlot,
  onEditEvent,
}: DayViewProps) {
  const { ref: gridRef, zoom: hourHeight } = useZoom<HTMLDivElement>({
    initial: HOUR_HEIGHT_DEFAULT,
  });
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const now = useMemo(() => new Date(nowMs), [nowMs]);

  // Hour grid: in mode "scope" we list 00..23 starting at midnight of
  // `anchor`. In mode "around" the first cell is currentHour-12 so
  // "now" sits in the middle of the grid; in mode "future" the
  // first cell is currentHour and wraps through tomorrow. The
  // grid label displays the literal clock value.
  const hourOffsets = useMemo(() => {
    if (mode === "scope") {
      return { startHour: 0, hours: Array.from({ length: 24 }, (_, i) => i) };
    }
    return getDayViewHourOffsets(now, mode);
  }, [mode, now]);

  // Effective day for filtering events. In scope mode this is the
  // user-selected anchor. In around/future modes the day grid starts
  // at the current hour, so the "day" boundary is shifted: we use the
  // current local date as the anchor string and let the events range
  // (passed to useEvents) carry the actual coverage.
  const effectiveDay = useMemo(() => {
    if (mode === "scope") return anchor;
    const local = new Date(nowMs + tzOffset * 60_000);
    return `${local.getUTCFullYear()}-${pad(local.getUTCMonth() + 1)}-${pad(local.getUTCDate())}`;
  }, [mode, anchor, nowMs, tzOffset]);

  const allDayEvents = useMemo(
    () => events.filter((e) => e.allDay && eventSpansDay(e, effectiveDay, tzOffset)),
    [events, effectiveDay, tzOffset],
  );
  const timedEvents = useMemo(
    () => events.filter((e) => !e.allDay && eventSpansDay(e, effectiveDay, tzOffset)),
    [events, effectiveDay, tzOffset],
  );
  const layout = useMemo(
    () => layoutDayLanes(timedEvents, effectiveDay, hourHeight, tzOffset),
    [timedEvents, effectiveDay, hourHeight, tzOffset],
  );

  // Local date for the now-indicator check. `anchor` is a local
  // YYYY-MM-DD (set by CalendarMain's localIsoDate), so the comparison
  // must also use local date methods — UTC-based getUTCDate() can
  // disagree with the local day around midnight in non-UTC zones and
  // would hide the now bar even on today.
  const nowDay = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const isToday = mode === "scope" ? nowDay === anchor : true;
  // Position of the "now" indicator inside the (mode-aware) hour grid:
  // subtract the grid's startHour so the line lands on the current hour
  // even when the grid is rotated (around/future).
  const nowMins = now.getHours() * 60 + now.getMinutes();
  const nowTop = (((nowMins - hourOffsets.startHour * 60 + 24 * 60) % (24 * 60)) / 60) * hourHeight;

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-xs text-foreground-subtle">
        Loading…
      </div>
    );
  }

  return (
    <div className="flex flex-col rounded-md border border-surface-2 bg-surface-0">
      <div className="sticky top-0 z-30 flex items-center gap-2 border-b border-surface-2 bg-surface-1 px-3 py-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-foreground-subtle">
          All day
        </span>
        <AllDayLane events={allDayEvents} onEditEvent={onEditEvent} />
      </div>
      <div ref={gridRef} className="relative flex" style={{ height: `${24 * hourHeight}px` }}>
        <div className="flex w-16 shrink-0 flex-col border-r border-surface-2">
          {hourOffsets.hours.map((h, idx) => (
            <div
              key={`${h}-${idx}`}
              className="flex items-start justify-end pr-2 pt-1"
              style={{ height: `${hourHeight}px` }}
            >
              <span className="font-mono text-[10px] text-foreground-subtle">{pad(h)}:00</span>
            </div>
          ))}
        </div>
        <div
          className="relative flex-1 bg-[linear-gradient(to_bottom,color-mix(in_oklab,var(--color-surface-2)_70%,transparent)_1px,transparent_1px)]"
          style={{ backgroundSize: `100% ${hourHeight}px` }}
        >
          {hourOffsets.hours.map((h, idx) => (
            <button
              key={`slot-${h}-${idx}`}
              type="button"
              data-testid={`day-slot-${effectiveDay}-${pad(h)}`}
              data-slot-anchor={effectiveDay}
              onClick={
                onCreateAtSlot
                  ? // For around/future we anchor slot creation to the
                    // start of the displayed window so the new tile
                    // lands inside the visible range.
                    () => onCreateAtSlot(mode === "scope" ? effectiveDay : effectiveDay, h)
                  : undefined
              }
              className="block w-full border-b border-surface-2/60 text-left hover:bg-surface-1/40 focus:outline-hidden focus-visible:bg-surface-1/40"
              style={{ height: `${hourHeight}px`, padding: 0 }}
            />
          ))}
          {layout.map(({ event, top, height, laneIndex, laneCount }) => {
            const tile = eventTileStyle(event.color);
            const widthPct = 100 / laneCount;
            const leftPct = widthPct * laneIndex;
            return (
              <button
                key={event.id}
                type="button"
                data-testid={`day-event-${event.id}`}
                data-lane={laneIndex}
                data-lane-count={laneCount}
                data-tile-id={event.id}
                onClick={onEditEvent ? () => onEditEvent(event) : undefined}
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
                  <span className="truncate text-xs font-medium">
                    {event.title || "(untitled)"}
                  </span>
                </div>
                <div className="mt-0.5 truncate font-mono text-[10px] opacity-80">
                  {formatLocalTimeOfDay(event.start, tzOffset)} –{" "}
                  {formatLocalTimeOfDay(event.end, tzOffset)}
                </div>
                {event.location ? (
                  <div className="mt-0.5 truncate text-[10px] opacity-70">{event.location}</div>
                ) : null}
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
      </div>
    </div>
  );
}

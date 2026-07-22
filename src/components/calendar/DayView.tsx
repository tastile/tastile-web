"use client";
import { useMemo, useState } from "react";
import {
  type DisplayMode,
  eventSpansDay,
  getDayViewHourOffsets,
  layoutDayLanes,
} from "@/lib/calendar/layout";
import type { CalendarEvent } from "@/lib/domain/calendar";
import { useMinuteClock } from "@/lib/hooks/minute-clock";
import { useZoom } from "@/lib/hooks/use-zoom";
import { AllDayLane } from "./AllDayLane";
import { DayViewFrame } from "./DayViewFrame";
import { DayViewTile } from "./DayViewTile";
import { NowIndicator } from "./NowIndicator";

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
  // Tick only drives the dynamic content (NowIndicator + effectiveDay
  // in around/future). The frame's props do NOT depend on nowMs in
  // scope mode, so the memoized DayViewFrame skips re-render entirely.
  // Shared 60s clock — provider lives in /dashboard/timeline/page.tsx
  // and serves all calendar subviews (DayView/WeekView/NowIndicator).
  const sharedNowMs = useMinuteClock();
  const [fallbackMs] = useState(() => Date.now());
  const nowMs = sharedNowMs ?? fallbackMs;

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

  // Dynamic content slotted into the memoized frame:
  //   allDayArea — chips above the time grid (changes with events)
  //   eventsArea — tiles + now-line + loading overlay (changes with
  //   events, nowMs tick, and loading flag)
  const eventsArea = (
    <>
      {layout.map(({ event, top, height, laneIndex, laneCount }) => (
        <DayViewTile
          key={event.id}
          event={event}
          top={top}
          height={height}
          laneIndex={laneIndex}
          laneCount={laneCount}
          tzOffset={tzOffset}
          onEditEvent={onEditEvent}
        />
      ))}
      <NowIndicator
        hourHeight={hourHeight}
        startHour={hourOffsets.startHour}
        effectiveDay={effectiveDay}
      />
      {loading ? (
        <div
          data-testid="day-loading"
          className="pointer-events-none absolute inset-0 flex items-start justify-center bg-surface-0/40 pt-4 text-[10px] uppercase tracking-wider text-foreground-subtle"
        >
          Loading…
        </div>
      ) : null}
    </>
  );

  return (
    <DayViewFrame
      gridRef={gridRef}
      hourHeight={hourHeight}
      hours={hourOffsets.hours}
      effectiveDay={effectiveDay}
      onCreateAtSlot={onCreateAtSlot}
      allDayArea={<AllDayLane events={allDayEvents} onEditEvent={onEditEvent} />}
      eventsArea={eventsArea}
    />
  );
}
